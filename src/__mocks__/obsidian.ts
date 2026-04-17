export class Plugin {
  app!: App;
}
export class Notice {
  constructor(public message: string) {}
}

export interface TFile {
  path: string;
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };
}

export interface TFolder {
  path: string;
  name: string;
  children: (TFile | TFolder)[];
}

export interface TAbstractFile {
  path: string;
}

export interface App {
  vault: Vault;
  metadataCache: MetadataCache;
  fileManager: FileManager;
}

export interface Vault {
  getAbstractFileByPath(path: string): TAbstractFile | null;
  getFiles(): TFile[];
  getFolderByPath(path: string): TFolder | null;
  read(file: TFile): Promise<string>;
  create(path: string, content: string): Promise<TFile>;
  modify(file: TFile, content: string): Promise<void>;
  delete(file: TAbstractFile): Promise<void>;
  adapter: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
  };
}

export interface MetadataCache {
  getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null;
  on(event: 'resolve', cb: (file: TFile) => void): void;
}

export interface FileManager {
  processFrontMatter(
    file: TFile,
    fn: (fm: Record<string, unknown>) => void,
  ): Promise<void>;
}
