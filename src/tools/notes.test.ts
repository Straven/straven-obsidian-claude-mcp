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

// ── vault_create ──────────────────────────────────────────────────────────────

describe('vault_create', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn(() => null),
        getFiles: vi.fn(),
        read: vi.fn(),
        create: vi.fn(async (path: string) => mockFile(path)),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('creates a new note', async () => {
    const result = await mcp.call('vault_create', { path: 'new.md', content: '# New' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('new.md');
    expect(app.vault.create).toHaveBeenCalledWith('new.md', '# New');
  });

  it('returns FILE_EXISTS when file already present', async () => {
    (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(mockFile('new.md'));
    const result = await mcp.call('vault_create', { path: 'new.md', content: '' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_EXISTS');
  });
});

// ── vault_update ──────────────────────────────────────────────────────────────

describe('vault_update', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(),
        create: vi.fn(),
        modify: vi.fn(async () => undefined),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('updates an existing note', async () => {
    const result = await mcp.call('vault_update', { path: 'note.md', content: '# Updated' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('note.md');
    expect(app.vault.modify).toHaveBeenCalledWith(mockFile('note.md'), '# Updated');
  });

  it('returns FILE_NOT_FOUND for missing note', async () => {
    const result = await mcp.call('vault_update', { path: 'missing.md', content: '' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});

// ── vault_delete ──────────────────────────────────────────────────────────────

describe('vault_delete', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(async () => undefined),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('deletes a note', async () => {
    const result = await mcp.call('vault_delete', { path: 'note.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
    expect(app.vault.delete).toHaveBeenCalled();
  });

  it('returns FILE_NOT_FOUND for missing note', async () => {
    const result = await mcp.call('vault_delete', { path: 'missing.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});

describe('vault_search', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    const files = [
      mockFile('a.md'),
      mockFile('b.md'),
      mockFile('c.md'),
    ];
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn(),
        getFiles: vi.fn(() => files),
        read: vi.fn(async (f: TFile) => {
          if (f.path === 'a.md') return '# Apple\nThis has the keyword apple';
          if (f.path === 'b.md') return '# Banana\nNo match here';
          return '# Cherry\napple is here too';
        }),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('finds files containing the query', async () => {
    const result = await mcp.call('vault_search', { query: 'apple' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(2);
    expect(data.matches.map((m: { path: string }) => m.path)).toContain('a.md');
    expect(data.matches.map((m: { path: string }) => m.path)).toContain('c.md');
  });

  it('returns empty matches for no results', async () => {
    const result = await mcp.call('vault_search', { query: 'zzznomatch' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(0);
  });

  it('truncates results when 20 files match', async () => {
    // Create 22 files that all match
    const manyFiles = Array.from({ length: 22 }, (_, i) => mockFile(`file${i}.md`));
    (app.vault.getFiles as ReturnType<typeof vi.fn>).mockReturnValue(manyFiles);
    (app.vault.read as ReturnType<typeof vi.fn>).mockResolvedValue('apple content here');
    const result = await mcp.call('vault_search', { query: 'apple', timeout_ms: 5000 }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(20);
    expect(data.truncated).toBe(true);
  });
});

describe('vault_append', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;
  let capturedContent: string;

  beforeEach(() => {
    capturedContent = '';
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(async () => '# Existing\n\nContent here'),
        create: vi.fn(),
        modify: vi.fn(async (_f: TFile, c: string) => { capturedContent = c; }),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('appends content to file', async () => {
    const result = await mcp.call('vault_append', { path: 'note.md', content: '\n## New Section\n\nAdded text' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('note.md');
    expect(capturedContent).toContain('# Existing');
    expect(capturedContent).toContain('## New Section');
  });

  it('returns FILE_NOT_FOUND for missing note', async () => {
    const result = await mcp.call('vault_append', { path: 'missing.md', content: 'x' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});

describe('vault_patch', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;
  let capturedContent: string;

  const INITIAL = `# Title

## Section A

Content of A.

## Section B

Content of B.
`;

  beforeEach(() => {
    capturedContent = '';
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(async () => INITIAL),
        create: vi.fn(),
        modify: vi.fn(async (_f: TFile, c: string) => { capturedContent = c; }),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('replaces section content under a heading', async () => {
    await mcp.call('vault_patch', {
      path: 'note.md',
      heading: '## Section A',
      mode: 'replace',
      content: 'Replaced A content.',
    });
    expect(capturedContent).toContain('## Section A\n\nReplaced A content.');
    expect(capturedContent).toContain('## Section B');
    expect(capturedContent).not.toContain('Content of A');
  });

  it('appends to section content under a heading', async () => {
    await mcp.call('vault_patch', {
      path: 'note.md',
      heading: '## Section A',
      mode: 'append',
      content: '\nAppended line.',
    });
    expect(capturedContent).toContain('Content of A.\n\nAppended line.');
  });

  it('prepends to section content under a heading', async () => {
    await mcp.call('vault_patch', {
      path: 'note.md',
      heading: '## Section A',
      mode: 'prepend',
      content: 'Prepended line.\n\n',
    });
    expect(capturedContent).toContain('## Section A\n\nPrepended line.\n\nContent of A.');
  });

  it('returns HEADING_NOT_FOUND for missing heading', async () => {
    const result = await mcp.call('vault_patch', {
      path: 'note.md',
      heading: '## Nonexistent',
      mode: 'replace',
      content: 'x',
    }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('HEADING_NOT_FOUND');
  });

  it('is case-sensitive — wrong case returns HEADING_NOT_FOUND', async () => {
    const result = await mcp.call('vault_patch', {
      path: 'note.md',
      heading: '## section a',  // lowercase — doc has "## Section A"
      mode: 'replace',
      content: 'x',
    }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('HEADING_NOT_FOUND');
  });
});

describe('vault_get_properties', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;

  beforeEach(() => {
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter: { title: 'My Note', tags: ['a', 'b'], done: false } })),
        on: vi.fn(),
      },
      fileManager: { processFrontMatter: vi.fn() },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('returns all frontmatter properties', async () => {
    const result = await mcp.call('vault_get_properties', { path: 'note.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.properties).toEqual({ title: 'My Note', tags: ['a', 'b'], done: false });
  });

  it('returns FILE_NOT_FOUND for missing file', async () => {
    const result = await mcp.call('vault_get_properties', { path: 'missing.md' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});

describe('vault_set_property', () => {
  let app: App;
  let mcp: ReturnType<typeof makeMcp>;
  let capturedFm: Record<string, unknown>;

  beforeEach(() => {
    capturedFm = {};
    app = {
      vault: {
        getFolderByPath: vi.fn(),
        getAbstractFileByPath: vi.fn((p: string) => (p === 'note.md' ? mockFile('note.md') : null)),
        getFiles: vi.fn(),
        read: vi.fn(),
        create: vi.fn(),
        modify: vi.fn(),
        delete: vi.fn(),
        adapter: { read: vi.fn(), write: vi.fn() },
      },
      metadataCache: { getFileCache: vi.fn(), on: vi.fn() },
      fileManager: {
        processFrontMatter: vi.fn(async (_f: TFile, fn: (fm: Record<string, unknown>) => void) => {
          fn(capturedFm);
        }),
      },
    } as unknown as App;
    mcp = makeMcp();
    new NotesTools(app).register(mcp as unknown as McpServer);
  });

  it('sets a frontmatter property', async () => {
    const result = await mcp.call('vault_set_property', { path: 'note.md', key: 'status', value: 'done' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.path).toBe('note.md');
    expect(capturedFm['status']).toBe('done');
  });

  it('returns FILE_NOT_FOUND for missing file', async () => {
    const result = await mcp.call('vault_set_property', { path: 'missing.md', key: 'x', value: '1' }) as { content: { text: string }[] };
    const data = JSON.parse(result.content[0].text);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });
});
