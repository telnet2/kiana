/**
 * VFSMemFS2 - Improved VFS and MemFS Integration
 *
 * Key improvements over VFSMemFS:
 * - Fully async API with proper await for VFS operations
 * - Proper error propagation (not swallowed)
 * - Binary data support with Buffer storage
 * - Awaitable pre-population
 * - Correct delete handling (rm for directories, unlink for files)
 * - Separate tracking for deleted paths
 */

import * as path from 'path';

// VFS Client interface - complete subset needed for integration
export interface VFSClient2 {
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void>;
  writeFileText(path: string, text: string, options?: any): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | VFSDirectoryEntry2[]>;
  stat(path: string): Promise<VFSFileStat2>;
  unlink(path: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface VFSFileStat2 {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  ctime: Date;
}

export interface VFSDirectoryEntry2 {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface VFSMemFS2Options {
  vfs: VFSClient2;
  baseDirectory: string;
  writeMode: 'sync' | 'flush';
  cacheOnRead?: boolean;
}

export interface VFSMemFS2Statistics {
  dirtyFiles: number;
  deletedFiles: number;
  cachedFiles: number;
  totalFiles: number;
  totalDirectories: number;
  syncInProgress: boolean;
  lastSyncTime?: Date;
}

// Error class for VFSMemFS2
export class VFSMemFS2Error extends Error {
  code?: string;
  path?: string;

  constructor(message: string, code?: string, path?: string) {
    super(message);
    this.name = 'VFSMemFS2Error';
    this.code = code;
    this.path = path;
  }
}

// Node types
export type MemNode2Type = 'file' | 'directory';

export abstract class MemNode2 {
  public name: string;
  public parent: MemDirectory2 | null;
  public createdAt: Date;
  public modifiedAt: Date;

  protected constructor(name: string, parent: MemDirectory2 | null = null) {
    this.name = name;
    this.parent = parent;
    this.createdAt = new Date();
    this.modifiedAt = new Date();
  }

  getPath(): string {
    if (!this.parent) {
      return '/';
    }
    const parentPath = this.parent.getPath();
    return parentPath === '/' ? `/${this.name}` : `${parentPath}/${this.name}`;
  }

  isFile(): this is MemFile2 {
    return this instanceof MemFile2;
  }

  isDirectory(): this is MemDirectory2 {
    return this instanceof MemDirectory2;
  }
}

export class MemFile2 extends MemNode2 {
  private content: Buffer;

  constructor(name: string, content: string | Buffer = '', parent: MemDirectory2 | null = null) {
    super(name, parent);
    this.content = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  }

  write(content: string | Buffer): void {
    this.content = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    this.modifiedAt = new Date();
  }

  append(content: string | Buffer): void {
    const appendBuffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    this.content = Buffer.concat([this.content, appendBuffer]);
    this.modifiedAt = new Date();
  }

  readAsString(encoding: BufferEncoding = 'utf8'): string {
    return this.content.toString(encoding);
  }

  readAsBuffer(): Buffer {
    return this.content;
  }

  size(): number {
    return this.content.length;
  }
}

export class MemDirectory2 extends MemNode2 {
  public children: Map<string, MemNode2>;

  constructor(name: string, parent: MemDirectory2 | null = null) {
    super(name, parent);
    this.children = new Map<string, MemNode2>();
  }

  addChild(node: MemNode2): void {
    this.children.set(node.name, node);
    node.parent = this;
    this.modifiedAt = new Date();
  }

  removeChild(name: string): boolean {
    const removed = this.children.delete(name);
    if (removed) {
      this.modifiedAt = new Date();
    }
    return removed;
  }

  getChild(name: string): MemNode2 | undefined {
    return this.children.get(name);
  }

  hasChild(name: string): boolean {
    return this.children.has(name);
  }

  listChildren(): MemNode2[] {
    return Array.from(this.children.values());
  }
}

interface ParsedPath2 {
  dir: MemDirectory2;
  name: string;
}

export class VFSMemFS2 {
  public readonly root: MemDirectory2;
  private vfs: VFSClient2;
  private baseDirectory: string;
  private writeMode: 'sync' | 'flush';
  private cacheOnRead: boolean;
  private dirtyPaths: Set<string> = new Set();
  private deletedPaths: Set<string> = new Set();
  private syncInProgress: boolean = false;
  private lastSyncTime?: Date;

  constructor(options: VFSMemFS2Options) {
    this.root = new MemDirectory2('');
    this.vfs = options.vfs;
    this.baseDirectory = options.baseDirectory;
    this.writeMode = options.writeMode;
    this.cacheOnRead = options.cacheOnRead ?? true;
  }

  // Path resolution
  resolvePath(pathStr: string): MemNode2 | null {
    if (!pathStr || pathStr === '/') {
      return this.root;
    }

    const isAbsolute = pathStr.startsWith('/');
    const parts = pathStr.split('/').filter((p) => p && p !== '.');
    let current: MemNode2 = isAbsolute ? this.root : this.root;

    for (const part of parts) {
      if (part === '..') {
        current = current.parent ?? current;
        continue;
      }

      if (!current.isDirectory()) {
        return null;
      }

      const child = current.getChild(part);
      if (!child) {
        return null;
      }
      current = child;
    }

    return current;
  }

  private parsePath(pathStr: string): ParsedPath2 | null {
    if (!pathStr || pathStr === '/') {
      return { dir: this.root, name: '' };
    }

    const isAbsolute = pathStr.startsWith('/');
    const parts = pathStr.split('/').filter((p) => p && p !== '.');
    const name = parts.pop();

    if (!name) {
      return null;
    }

    let current: MemNode2 = isAbsolute ? this.root : this.root;
    for (const part of parts) {
      if (part === '..') {
        current = current.parent ?? current;
      } else {
        if (!current.isDirectory()) {
          return null;
        }
        const child = current.getChild(part);
        if (!child || !child.isDirectory()) {
          return null;
        }
        current = child;
      }
    }

    if (!current.isDirectory()) {
      return null;
    }

    return { dir: current, name };
  }

  // File operations - fully async
  async createFile(pathStr: string, content: string | Buffer = ''): Promise<MemFile2> {
    const parsed = this.parsePath(pathStr);
    if (!parsed) {
      throw new VFSMemFS2Error(`Cannot create file: invalid path ${pathStr}`, 'EINVAL', pathStr);
    }

    const { dir, name } = parsed;
    if (!name) {
      throw new VFSMemFS2Error('Cannot create file: invalid filename', 'EINVAL', pathStr);
    }

    if (dir.hasChild(name)) {
      throw new VFSMemFS2Error(`File or directory already exists: ${name}`, 'EEXIST', pathStr);
    }

    const file = new MemFile2(name, content, dir);
    dir.addChild(file);

    if (this.writeMode === 'sync') {
      await this.syncFileToVFS(pathStr);
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return file;
  }

  async writeFile(pathStr: string, content: string | Buffer): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (node?.isFile()) {
      node.write(content);
    } else if (node) {
      throw new VFSMemFS2Error(`Path exists but is not a file: ${pathStr}`, 'EISDIR', pathStr);
    } else {
      await this.createFile(pathStr, content);
      return;
    }

    if (this.writeMode === 'sync') {
      await this.syncFileToVFS(pathStr);
    } else {
      this.dirtyPaths.add(pathStr);
    }
  }

  async appendFile(pathStr: string, content: string | Buffer): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (!node?.isFile()) {
      throw new VFSMemFS2Error(`No such file: ${pathStr}`, 'ENOENT', pathStr);
    }

    node.append(content);

    if (this.writeMode === 'sync') {
      await this.syncFileToVFS(pathStr);
    } else {
      this.dirtyPaths.add(pathStr);
    }
  }

  // Read file content (sync operation - reads from memory)
  readFile(pathStr: string, encoding?: BufferEncoding): string | Buffer {
    const node = this.resolvePath(pathStr);
    if (!node) {
      throw new VFSMemFS2Error(`No such file: ${pathStr}`, 'ENOENT', pathStr);
    }
    if (!node.isFile()) {
      throw new VFSMemFS2Error(`Not a file: ${pathStr}`, 'EISDIR', pathStr);
    }

    if (encoding) {
      return node.readAsString(encoding);
    }
    return node.readAsBuffer();
  }

  // Directory operations
  async createDirectory(pathStr: string): Promise<MemDirectory2> {
    const parsed = this.parsePath(pathStr);
    if (!parsed) {
      throw new VFSMemFS2Error(`Cannot create directory: invalid path ${pathStr}`, 'EINVAL', pathStr);
    }

    const { dir, name } = parsed;
    if (!name) {
      throw new VFSMemFS2Error('Cannot create directory: invalid name', 'EINVAL', pathStr);
    }

    if (dir.hasChild(name)) {
      throw new VFSMemFS2Error(`File or directory already exists: ${name}`, 'EEXIST', pathStr);
    }

    const newDir = new MemDirectory2(name, dir);
    dir.addChild(newDir);

    if (this.writeMode === 'sync') {
      const vfsPath = this.toVFSPath(pathStr);
      await this.vfs.mkdir(vfsPath, { recursive: true });
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return newDir;
  }

  async createDirectories(pathStr: string): Promise<MemDirectory2> {
    const isAbsolute = pathStr.startsWith('/');
    const parts = pathStr.split('/').filter((p) => p && p !== '.');
    let current: MemDirectory2 = this.root;
    let currentPath = '';

    for (const part of parts) {
      if (part === '..') {
        current = current.parent ?? current;
        currentPath = current.getPath();
      } else {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        let child = current.getChild(part);
        if (!child) {
          child = new MemDirectory2(part, current);
          current.addChild(child);

          if (this.writeMode === 'sync') {
            const vfsPath = this.toVFSPath(currentPath);
            await this.vfs.mkdir(vfsPath, { recursive: true });
          } else {
            this.dirtyPaths.add(currentPath);
          }
        } else if (!child.isDirectory()) {
          throw new VFSMemFS2Error(`Not a directory: ${part}`, 'ENOTDIR', currentPath);
        }
        current = child as MemDirectory2;
      }
    }

    return current;
  }

  // Remove file or directory
  async remove(pathStr: string, recursive = false): Promise<boolean> {
    const node = this.resolvePath(pathStr);
    if (!node) {
      throw new VFSMemFS2Error(`No such file or directory: ${pathStr}`, 'ENOENT', pathStr);
    }

    if (node === this.root) {
      throw new VFSMemFS2Error('Cannot remove root directory', 'EPERM', pathStr);
    }

    if (node.isDirectory() && node.children.size > 0 && !recursive) {
      throw new VFSMemFS2Error(`Directory not empty: ${pathStr}`, 'ENOTEMPTY', pathStr);
    }

    if (!node.parent) {
      throw new VFSMemFS2Error('Cannot remove node without parent', 'EINVAL', pathStr);
    }

    const result = node.parent.removeChild(node.name);

    if (result) {
      // Remove from dirty paths since it's deleted
      this.dirtyPaths.delete(pathStr);

      if (this.writeMode === 'sync') {
        const vfsPath = this.toVFSPath(pathStr);
        try {
          if (node.isDirectory()) {
            await this.vfs.rm(vfsPath, { recursive: true });
          } else {
            await this.vfs.unlink(vfsPath);
          }
        } catch (error: any) {
          // If file doesn't exist on VFS, that's okay
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      } else {
        this.deletedPaths.add(pathStr);
      }
    }

    return result;
  }

  // List directory contents
  listDirectory(pathStr: string): MemNode2[] {
    const node = this.resolvePath(pathStr);
    if (!node) {
      throw new VFSMemFS2Error(`No such directory: ${pathStr}`, 'ENOENT', pathStr);
    }
    if (!node.isDirectory()) {
      throw new VFSMemFS2Error(`Not a directory: ${pathStr}`, 'ENOTDIR', pathStr);
    }
    return node.listChildren();
  }

  // VFS synchronization
  private async syncFileToVFS(pathStr: string): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (!node?.isFile()) return;

    const vfsPath = this.toVFSPath(pathStr);
    const content = node.readAsBuffer();

    // Ensure parent directory exists in VFS
    const parentDir = path.dirname(vfsPath);
    if (parentDir !== '/') {
      try {
        await this.vfs.mkdir(parentDir, { recursive: true });
      } catch (error: any) {
        // Ignore EEXIST errors - directory may have been created by concurrent operation
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }

    // Write as text if it's valid UTF-8, otherwise as binary
    if (this.isValidUtf8(content)) {
      await this.vfs.writeFileText(vfsPath, content.toString('utf8'));
    } else {
      await this.vfs.writeFile(vfsPath, new Uint8Array(content));
    }

    this.dirtyPaths.delete(pathStr);
    this.lastSyncTime = new Date();
  }

  private isValidUtf8(buffer: Buffer): boolean {
    try {
      const str = buffer.toString('utf8');
      return Buffer.from(str, 'utf8').equals(buffer);
    } catch {
      return false;
    }
  }

  // Flush all dirty files to VFS
  async flush(): Promise<void> {
    if (this.syncInProgress) {
      throw new VFSMemFS2Error('Sync already in progress', 'EBUSY');
    }

    this.syncInProgress = true;

    try {
      // First, handle deletions
      const deletions = Array.from(this.deletedPaths);
      for (const pathStr of deletions) {
        const vfsPath = this.toVFSPath(pathStr);
        try {
          await this.vfs.rm(vfsPath, { recursive: true });
        } catch (error: any) {
          // Ignore ENOENT errors for deletions
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
        this.deletedPaths.delete(pathStr);
      }

      // Then sync dirty files and directories
      const paths = Array.from(this.dirtyPaths);

      // Sort paths so parent directories are created first
      paths.sort((a, b) => a.split('/').length - b.split('/').length);

      for (const pathStr of paths) {
        await this.syncPathToVFS(pathStr);
      }
    } finally {
      this.syncInProgress = false;
      this.lastSyncTime = new Date();
    }
  }

  private async syncPathToVFS(pathStr: string): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (!node) {
      // Node was deleted, remove from dirty
      this.dirtyPaths.delete(pathStr);
      return;
    }

    if (node.isFile()) {
      await this.syncFileToVFS(pathStr);
    } else if (node.isDirectory()) {
      const vfsPath = this.toVFSPath(pathStr);
      await this.vfs.mkdir(vfsPath, { recursive: true });
      this.dirtyPaths.delete(pathStr);
    }
  }

  // Pre-populate from VFS (awaitable)
  async prePopulate(): Promise<void> {
    await this.populateDirectory('/');
  }

  private async populateDirectory(dirPath: string): Promise<void> {
    const vfsPath = this.toVFSPath(dirPath);

    try {
      const entries = await this.vfs.readdir(vfsPath, { withFileTypes: true });

      for (const entry of entries) {
        // Handle both string[] and VFSDirectoryEntry2[] return types
        const entryName = typeof entry === 'string' ? entry : entry.name;
        const memPath = dirPath === '/' ? `/${entryName}` : `${dirPath}/${entryName}`;

        // For string entries, we need to stat to determine type
        let isDir = false;
        let isFile = false;

        if (typeof entry === 'string') {
          try {
            const entryPath = vfsPath === '/' ? `/${entryName}` : `${vfsPath}/${entryName}`;
            const stat = await this.vfs.stat(entryPath);
            isDir = stat.isDirectory();
            isFile = stat.isFile();
          } catch {
            continue; // Skip if we can't stat
          }
        } else {
          isDir = entry.isDirectory();
          isFile = entry.isFile();
        }

        if (isDir) {
          // Create directory in memory if it doesn't exist
          if (!this.resolvePath(memPath)) {
            const parsed = this.parsePath(memPath);
            if (parsed && parsed.name) {
              const newDir = new MemDirectory2(parsed.name, parsed.dir);
              parsed.dir.addChild(newDir);
            }
          }
          // Recursively populate subdirectory
          await this.populateDirectory(memPath);
        } else if (isFile) {
          try {
            // Read file content from VFS
            const vfsFilePath = vfsPath === '/' ? `/${entryName}` : `${vfsPath}/${entryName}`;
            const content = await this.vfs.readFile(vfsFilePath);

            // Create file in memory
            const parsed = this.parsePath(memPath);
            if (parsed && parsed.name) {
              const buffer = content instanceof Uint8Array
                ? Buffer.from(content)
                : Buffer.from(content, 'utf8');
              const file = new MemFile2(parsed.name, buffer, parsed.dir);
              parsed.dir.addChild(file);
            }
          } catch (error: any) {
            // Log but continue with other files
            console.warn(`Failed to populate file ${memPath}:`, error.message);
          }
        }
      }
    } catch (error: any) {
      // Directory might not exist, which is fine for initial setup
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // Path conversion utilities
  private toVFSPath(memPath: string): string {
    if (memPath === '/') {
      return this.baseDirectory;
    }
    return path.join(this.baseDirectory, memPath);
  }

  // Statistics
  getStatistics(): VFSMemFS2Statistics {
    let cachedFiles = 0;
    let totalFiles = 0;
    let totalDirectories = 0;

    const countNodes = (node: MemNode2): void => {
      if (node.isFile()) {
        totalFiles++;
        if (!this.dirtyPaths.has(node.getPath())) {
          cachedFiles++;
        }
      } else if (node.isDirectory()) {
        totalDirectories++;
        for (const child of (node as MemDirectory2).listChildren()) {
          countNodes(child);
        }
      }
    };

    for (const child of this.root.listChildren()) {
      countNodes(child);
    }

    return {
      dirtyFiles: this.dirtyPaths.size,
      deletedFiles: this.deletedPaths.size,
      cachedFiles,
      totalFiles,
      totalDirectories,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime
    };
  }

  // Utility methods
  isDirty(pathStr: string): boolean {
    return this.dirtyPaths.has(pathStr);
  }

  getDirtyPaths(): string[] {
    return Array.from(this.dirtyPaths);
  }

  getDeletedPaths(): string[] {
    return Array.from(this.deletedPaths);
  }

  setWriteMode(mode: 'sync' | 'flush'): void {
    this.writeMode = mode;
  }

  getWriteMode(): 'sync' | 'flush' {
    return this.writeMode;
  }

  getBaseDirectory(): string {
    return this.baseDirectory;
  }
}
