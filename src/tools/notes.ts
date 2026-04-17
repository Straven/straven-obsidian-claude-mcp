import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { App, TFile, TFolder } from 'obsidian';

// ─── Error model ──────────────────────────────────────────────────────────────

export type VaultErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FOLDER_NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'NOT_A_FILE'
  | 'HEADING_NOT_FOUND'
  | 'INVALID_PATH'
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
 */
export function resolvePath(raw: string): string {
  const p = raw.replace(/^\/+/, '').replace(/\/+/g, '/').trim();
  if (!p) throw new VaultError('INVALID_PATH', 'Path must not be empty');
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
function errorResponse(err: VaultError) {
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
    // tools will be registered here in subsequent tasks
  }
}
