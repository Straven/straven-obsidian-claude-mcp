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
  }
}
