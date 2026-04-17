import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultError, NotesTools } from './notes';
import type { App, TFile, TFolder } from 'obsidian';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function mockFile(path: string): TFile {
  return {
    path,
    basename: path.split('/').pop()!.replace(/\.[^.]+$/, ''),
    extension: path.split('.').pop() ?? '',
    stat: { mtime: 0, ctime: 0, size: 0 },
  };
}

function makeMcp() {
  const tools: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: (...args: unknown[]) => unknown) => {
      tools[name] = handler;
    }),
    call: (name: string, args: unknown) => (tools[name] as (a: unknown) => unknown)(args),
  } as unknown as McpServer & { call(n: string, a: unknown): unknown };
}

// ── VaultError ────────────────────────────────────────────────────────────────

describe('VaultError', () => {
  it('carries code and message', () => {
    const err = new VaultError('FILE_NOT_FOUND', 'test.md not found');
    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.message).toBe('test.md not found');
    expect(err).toBeInstanceOf(Error);
  });
});

// ── vault_list ────────────────────────────────────────────────────────────────

describe('vault_list', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    const root: TFolder = {
      path: '',
      name: '',
      children: [
        mockFile('note1.md'),
        mockFile('note2.md'),
        { path: 'sub', name: 'sub', children: [mockFile('sub/note3.md')] } as TFolder,
      ],
    };
    app = {
      vault: {
        getFolderByPath: vi.fn((p: string) => (p === '' || p === '/' ? root : null)),
        getAbstractFileByPath: vi.fn(),
        getFiles: vi.fn(() => [mockFile('note1.md'), mockFile('note2.md'), mockFile('sub/note3.md')]),
        read: vi.fn(),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: {
        getFileCache: vi.fn(),
        on: vi.fn(),
      },
      fileManager: {
        processFrontMatter: vi.fn(),
      },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('lists root folder', async () => {
    const result = await mcp.call('vault_list', { path: '' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('');
    expect(data.items).toHaveLength(3);
    expect(data.items[0]).toEqual({ name: 'note1.md', type: 'file' });
    expect(data.items[2]).toEqual({ name: 'sub', type: 'folder' });
  });

  it('returns FOLDER_NOT_FOUND for missing path', async () => {
    const result = await mcp.call('vault_list', { path: 'nonexistent' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FOLDER_NOT_FOUND');
  });
});

// ── vault_read ────────────────────────────────────────────────────────────────

describe('vault_read', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(async () => '---\ntitle: Test\n---\n\n# Hello\n\nWorld'),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: {
        getFileCache: vi.fn((_f: TFile) => ({ frontmatter: { title: 'Test' } })),
        on: vi.fn(),
      },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('returns content and frontmatter', async () => {
    const result = await mcp.call('vault_read', { path: 'note.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('note.md');
    expect(data.content).toContain('# Hello');
    expect(data.frontmatter).toEqual({ title: 'Test' });
  });

  it('returns FILE_NOT_FOUND for missing file', async () => {
    const result = await mcp.call('vault_read', { path: 'missing.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});
