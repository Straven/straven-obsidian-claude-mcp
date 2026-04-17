import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { App, TFile, TFolder } from 'obsidian';

// ─── Error model ──────────────────────────────────────────────────────────────

export type VaultErrorCode =
  | 'VAULT_NOT_READY'
  | 'FILE_NOT_FOUND'
  | 'FILE_EXISTS'
  | 'FOLDER_NOT_FOUND'
  | 'HEADING_NOT_FOUND'
  | 'INVALID_PATH'
  | 'BASES_NOT_AVAILABLE'
  | 'CANVAS_PARSE_ERROR'
  | 'INTERNAL_ERROR';

export class VaultError extends Error {
  constructor(
    public readonly code: VaultErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Normalise a path: strip leading slash, collapse double slashes.
 * Returns the cleaned path or throws INVALID_PATH if empty after normalisation.
 * Rejects paths containing `..` to prevent traversal attacks.
 */
export function resolvePath(raw: string): string {
  const p = raw.replace(/^\/+/, '').replace(/\/+/g, '/').trim();
  if (!p) throw new VaultError('INVALID_PATH', 'Path must not be empty');
  if (p.split('/').some((segment) => segment === '..'))
    throw new VaultError('INVALID_PATH', `Path traversal not allowed: ${raw}`);
  return p;
}

/**
 * Wrap an unknown thrown value into a VaultError.
 * If it's already a VaultError, pass through unchanged.
 */
export function wrap(err: unknown): VaultError {
  if (err instanceof VaultError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new VaultError('INTERNAL_ERROR', msg);
}

/** Format a VaultError as an MCP error response. */
export function errorResponse(err: VaultError) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: { code: err.code, message: err.message } }),
      },
    ],
  };
}

// ─── patchSection ─────────────────────────────────────────────────────────────

/**
 * Splice content into the section beneath a heading.
 * Heading must be the full line including # prefix (e.g. `## My Heading`).
 * Exact match, case-sensitive.
 * Section ends at the next heading of same or higher level (fewer #), or EOF.
 * Returns the new full document string.
 */
export function patchSection(
  doc: string,
  heading: string,
  mode: 'replace' | 'append' | 'prepend',
  content: string,
): string {
  const lines = doc.split('\n');
  const headingLevel = heading.match(/^(#+)/)?.[1].length ?? 0;

  // Find the heading line index (exact match of the full heading string)
  const headingIdx = lines.findIndex(
    (l) => l === heading || l.replace(/\s+$/, '') === heading,
  );
  if (headingIdx === -1) throw new VaultError('HEADING_NOT_FOUND', `Heading not found: ${heading}`);

  // Find the end of the section (next heading at same or higher level)
  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/);
    if (match && match[1].length <= headingLevel) {
      sectionEnd = i;
      break;
    }
  }

  // Split document into parts
  const headingPart = lines.slice(0, headingIdx + 1).join('\n');
  const bodyLines = lines.slice(headingIdx + 1, sectionEnd);
  const afterPart = lines.slice(sectionEnd).join('\n');
  const body = bodyLines.join('\n');

  let newBody: string;
  if (mode === 'replace') {
    newBody = '\n\n' + content.replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
  } else if (mode === 'append') {
    newBody = body + content;
  } else {
    // prepend: place content (preserving its trailing newlines) before existing body text
    newBody = '\n\n' + content + body.replace(/^\n+/, '');
  }

  const separator = afterPart.length > 0 ? '\n' : '';
  return headingPart + newBody + separator + afterPart;
}

// ─── NotesTools class ─────────────────────────────────────────────────────────

export class NotesTools {
  constructor(private readonly app: App) {}

  register(mcp: McpServer): void {
    // vault_list
    mcp.tool(
      'vault_list',
      'List files and folders at a vault path. Use path="" for vault root.',
      { path: z.string().default('').describe('Vault-relative path, e.g. "Projects" or ""') },
      async ({ path: rawPath }: { path: string }) => {
        try {
          const folderPath = rawPath === '/' ? '' : (rawPath ?? '');
          const resolved =
            this.app.vault.getFolderByPath(folderPath) ??
            (folderPath === '' ? this.app.vault.getFolderByPath('/') : null);
          if (!resolved) throw new VaultError('FOLDER_NOT_FOUND', `Folder not found: ${rawPath}`);
          const items = resolved.children.map((child) => ({
            name: child.path.split('/').pop() ?? child.path,
            type: 'extension' in child ? 'file' : 'folder',
          }));
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ path: folderPath, items }) }],
          };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_read
    mcp.tool(
      'vault_read',
      'Read a file from the vault. Returns content and frontmatter properties.',
      { path: z.string().describe('Vault-relative path, e.g. "Projects/note.md"') },
      async ({ path: rawPath }: { path: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          const file = abstract as TFile;
          const content = await this.app.vault.read(file);
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter ?? {};
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, content, frontmatter }) }],
          };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_create
    mcp.tool(
      'vault_create',
      'Create a new note. Fails if the file already exists.',
      {
        path: z.string().describe('Vault-relative path, e.g. "Projects/new-note.md"'),
        content: z.string().default('').describe('Initial markdown content'),
      },
      async ({ path: rawPath, content }: { path: string; content: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          if (this.app.vault.getAbstractFileByPath(filePath)) {
            throw new VaultError('FILE_EXISTS', `File already exists: ${filePath}`);
          }
          await this.app.vault.create(filePath, content);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, created: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_update
    mcp.tool(
      'vault_update',
      'Replace the full content of an existing note.',
      {
        path: z.string().describe('Vault-relative path'),
        content: z.string().describe('New markdown content (replaces entire file)'),
      },
      async ({ path: rawPath, content }: { path: string; content: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          await this.app.vault.modify(abstract as TFile, content);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, updated: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_delete
    mcp.tool(
      'vault_delete',
      'Delete a file from the vault.',
      { path: z.string().describe('Vault-relative path') },
      async ({ path: rawPath }: { path: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract) throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          await this.app.vault.delete(abstract);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, deleted: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_search
    mcp.tool(
      'vault_search',
      'Full-text search across all vault notes. Returns up to 20 matches. May return truncated results if vault is large.',
      {
        query: z.string().describe('Text to search for (case-insensitive)'),
        timeout_ms: z.number().optional().default(5000).describe('Search timeout in milliseconds (default 5000)'),
      },
      async ({ query, timeout_ms }: { query: string; timeout_ms: number }) => {
        try {
          const files = this.app.vault.getFiles();
          const lowerQuery = query.toLowerCase();
          const matches: { path: string; excerpt: string }[] = [];
          let truncated = false;
          let aborted = false;

          const timeoutHandle = setTimeout(() => {
            truncated = true;
            aborted = true;
          }, timeout_ms);

          try {
            for (const file of files) {
              if (aborted) break;
              const content = await this.app.vault.read(file);
              if (aborted) break;
              const lowerContent = content.toLowerCase();
              if (lowerContent.includes(lowerQuery)) {
                const idx = lowerContent.indexOf(lowerQuery);
                const start = Math.max(0, idx - 60);
                const end = Math.min(content.length, idx + query.length + 60);
                const excerpt = content.slice(start, end).trim();
                matches.push({ path: file.path, excerpt });
                if (matches.length >= 20) { truncated = true; break; }
              }
            }
          } finally {
            clearTimeout(timeoutHandle);
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ query, matches, truncated }) }],
          };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_append
    mcp.tool(
      'vault_append',
      'Append content to the end of an existing note.',
      {
        path: z.string().describe('Vault-relative path'),
        content: z.string().describe('Content to append'),
      },
      async ({ path: rawPath, content }: { path: string; content: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          const file = abstract as TFile;
          const existing = await this.app.vault.read(file);
          await this.app.vault.modify(file, existing + content);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, appended: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_patch
    mcp.tool(
      'vault_patch',
      'Edit content under a specific heading. Modes: replace (overwrite section body), append (add after), prepend (add before).',
      {
        path: z.string().describe('Vault-relative path'),
        heading: z.string().describe('Full heading line including # prefix, e.g. "## My Heading"'),
        mode: z.enum(['replace', 'append', 'prepend']).describe('How to apply the content change'),
        content: z.string().describe('Content to apply'),
      },
      async ({ path: rawPath, heading, mode, content }: { path: string; heading: string; mode: 'replace' | 'append' | 'prepend'; content: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          const file = abstract as TFile;
          const doc = await this.app.vault.read(file);
          const newDoc = patchSection(doc, heading, mode, content);
          await this.app.vault.modify(file, newDoc);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, patched: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_get_properties
    mcp.tool(
      'vault_get_properties',
      'Read all frontmatter properties from a note.',
      { path: z.string().describe('Vault-relative path') },
      async ({ path: rawPath }: { path: string }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          const file = abstract as TFile;
          const cache = this.app.metadataCache.getFileCache(file);
          const properties = cache?.frontmatter ?? {};
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, properties }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );

    // vault_set_property
    mcp.tool(
      'vault_set_property',
      'Write a single frontmatter property. Creates the property if it does not exist.',
      {
        path: z.string().describe('Vault-relative path'),
        key: z.string().describe('Property key'),
        value: z.unknown().describe('Property value (string, number, boolean, or array)'),
      },
      async ({ path: rawPath, key, value }: { path: string; key: string; value: unknown }) => {
        try {
          const filePath = resolvePath(rawPath);
          const abstract = this.app.vault.getAbstractFileByPath(filePath);
          if (!abstract || !('extension' in abstract)) {
            throw new VaultError('FILE_NOT_FOUND', `File not found: ${filePath}`);
          }
          const file = abstract as TFile;
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm[key] = value;
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify({ path: filePath, key, updated: true }) }] };
        } catch (e) {
          return errorResponse(wrap(e));
        }
      },
    );
  }
}
