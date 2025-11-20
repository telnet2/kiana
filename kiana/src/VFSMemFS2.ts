/**
 * VFSMemFS2 - Improved VFS and MemFS Integration
 *
 * Key improvements:
 * - Extends MemFS (consolidates node classes)
 * - Fully async API with proper await for VFS operations
 * - Sync API that respects writeMode config
 * - Proper error propagation
 * - Binary data support via Buffer in MemFile
 * - Awaitable pre-population
 * - Correct delete handling
 * - Separate tracking for deleted paths
 */

import * as path from 'path';
import { MemFS, MemFile, MemDirectory } from './MemFS';

// VFS Client interface
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

// Error class
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

export class VFSMemFS2 extends MemFS {
  private vfs: VFSClient2;
  private baseDirectory: string;
  private writeMode: 'sync' | 'flush';
  private cacheOnRead: boolean;
  private dirtyPaths: Set<string> = new Set();
  private deletedPaths: Set<string> = new Set();
  private syncInProgress: boolean = false;
  private lastSyncTime?: Date;

  constructor(options: VFSMemFS2Options) {
    super();
    this.vfs = options.vfs;
    this.baseDirectory = options.baseDirectory;
    this.writeMode = options.writeMode;
    this.cacheOnRead = options.cacheOnRead ?? true;
  }

  // ==================== OVERRIDE PARENT METHODS (respects writeMode) ====================

  override createFile(pathStr: string, content: string | Buffer = ''): MemFile {
    const file = super.createFile(pathStr, content);

    if (this.writeMode === 'sync') {
      this.syncFileToVFS(pathStr).catch(error => {
        console.error(`Failed to sync ${pathStr} to VFS:`, error);
      });
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return file;
  }

  // ==================== SYNC API (respects writeMode) ====================

  createFileSync(pathStr: string, content: string | Buffer = ''): MemFile {
    return this.createFile(pathStr, content);
  }

  override createDirectory(pathStr: string): MemDirectory {
    const dir = super.createDirectory(pathStr);

    if (this.writeMode === 'sync') {
      const vfsPath = this.toVFSPath(pathStr);
      this.vfs.mkdir(vfsPath, { recursive: true }).catch(error => {
        console.error(`Failed to create directory ${pathStr} in VFS:`, error);
      });
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return dir;
  }

  override createDirectories(pathStr: string): MemDirectory {
    const isAbsolute = pathStr.startsWith('/');
    const parts = pathStr.split('/').filter((p) => p && p !== '.');
    let current: MemDirectory = this.root;
    let currentPath = '';

    for (const part of parts) {
      if (part === '..') {
        current = current.parent ?? current;
        currentPath = current.getPath();
      } else {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        let child = current.getChild(part);
        if (!child) {
          child = new MemDirectory(part, current);
          current.addChild(child);

          if (this.writeMode === 'sync') {
            const vfsPath = this.toVFSPath(currentPath);
            this.vfs.mkdir(vfsPath, { recursive: true }).catch(error => {
              console.error(`Failed to create directory ${currentPath} in VFS:`, error);
            });
          } else {
            this.dirtyPaths.add(currentPath);
          }
        } else if (!child.isDirectory()) {
          throw new VFSMemFS2Error(`Not a directory: ${part}`, 'ENOTDIR', currentPath);
        }
        current = child as MemDirectory;
      }
    }

    return current;
  }

  override remove(pathStr: string, recursive = false): boolean {
    const node = this.resolvePath(pathStr);
    if (!node) {
      throw new Error(`No such file or directory: ${pathStr}`);
    }

    if (node === this.root) {
      throw new Error('Cannot remove root directory');
    }

    if (node.isDirectory() && node.children.size > 0 && !recursive) {
      throw new Error(`Directory not empty: ${pathStr}`);
    }

    if (!node.parent) {
      throw new Error('Cannot remove node without parent');
    }

    const result = node.parent.removeChild(node.name);

    if (result) {
      this.dirtyPaths.delete(pathStr);

      if (this.writeMode === 'sync') {
        const vfsPath = this.toVFSPath(pathStr);
        if (node.isDirectory()) {
          this.vfs.rm(vfsPath, { recursive: true }).catch(error => {
            if (error.code !== 'ENOENT') {
              console.error(`Failed to remove ${pathStr} from VFS:`, error);
            }
          });
        } else {
          this.vfs.unlink(vfsPath).catch(error => {
            if (error.code !== 'ENOENT') {
              console.error(`Failed to remove ${pathStr} from VFS:`, error);
            }
          });
        }
      } else {
        this.deletedPaths.add(pathStr);
      }
    }

    return result;
  }

  // ==================== ASYNC API ====================

  async createFileAsync(pathStr: string, content: string | Buffer = ''): Promise<MemFile> {
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

    const file = new MemFile(name, content, dir);
    dir.addChild(file);

    if (this.writeMode === 'sync') {
      await this.syncFileToVFS(pathStr);
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return file;
  }

  async writeFileAsync(pathStr: string, content: string | Buffer): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (node?.isFile()) {
      node.write(content);
    } else if (node) {
      throw new VFSMemFS2Error(`Path exists but is not a file: ${pathStr}`, 'EISDIR', pathStr);
    } else {
      await this.createFileAsync(pathStr, content);
      return;
    }

    if (this.writeMode === 'sync') {
      await this.syncFileToVFS(pathStr);
    } else {
      this.dirtyPaths.add(pathStr);
    }
  }

  async appendFileAsync(pathStr: string, content: string | Buffer): Promise<void> {
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

  readFileSync(pathStr: string, encoding?: BufferEncoding): string | Buffer {
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

  async createDirectoryAsync(pathStr: string): Promise<MemDirectory> {
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

    const newDir = new MemDirectory(name, dir);
    dir.addChild(newDir);

    if (this.writeMode === 'sync') {
      const vfsPath = this.toVFSPath(pathStr);
      await this.vfs.mkdir(vfsPath, { recursive: true });
    } else {
      this.dirtyPaths.add(pathStr);
    }

    return newDir;
  }

  async createDirectoriesAsync(pathStr: string): Promise<MemDirectory> {
    const isAbsolute = pathStr.startsWith('/');
    const parts = pathStr.split('/').filter((p) => p && p !== '.');
    let current: MemDirectory = this.root;
    let currentPath = '';

    for (const part of parts) {
      if (part === '..') {
        current = current.parent ?? current;
        currentPath = current.getPath();
      } else {
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
        let child = current.getChild(part);
        if (!child) {
          child = new MemDirectory(part, current);
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
        current = child as MemDirectory;
      }
    }

    return current;
  }

  async removeAsync(pathStr: string, recursive = false): Promise<boolean> {
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

  // ==================== VFS SYNCHRONIZATION ====================

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
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }

    // Write as text if valid UTF-8, otherwise as binary
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
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
        this.deletedPaths.delete(pathStr);
      }

      // Then sync dirty files and directories
      const paths = Array.from(this.dirtyPaths);
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

  async prePopulate(): Promise<void> {
    await this.populateDirectory('/');
  }

  private async populateDirectory(dirPath: string): Promise<void> {
    const vfsPath = this.toVFSPath(dirPath);

    try {
      const entries = await this.vfs.readdir(vfsPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryName = typeof entry === 'string' ? entry : entry.name;
        const memPath = dirPath === '/' ? `/${entryName}` : `${dirPath}/${entryName}`;

        let isDir = false;
        let isFile = false;

        if (typeof entry === 'string') {
          try {
            const entryPath = vfsPath === '/' ? `/${entryName}` : `${vfsPath}/${entryName}`;
            const stat = await this.vfs.stat(entryPath);
            isDir = stat.isDirectory();
            isFile = stat.isFile();
          } catch {
            continue;
          }
        } else {
          isDir = entry.isDirectory();
          isFile = entry.isFile();
        }

        if (isDir) {
          if (!this.resolvePath(memPath)) {
            const parsed = this.parsePath(memPath);
            if (parsed && parsed.name) {
              const newDir = new MemDirectory(parsed.name, parsed.dir);
              parsed.dir.addChild(newDir);
            }
          }
          await this.populateDirectory(memPath);
        } else if (isFile) {
          try {
            const vfsFilePath = vfsPath === '/' ? `/${entryName}` : `${vfsPath}/${entryName}`;
            const content = await this.vfs.readFile(vfsFilePath);

            const parsed = this.parsePath(memPath);
            if (parsed && parsed.name) {
              const buffer = content instanceof Uint8Array
                ? Buffer.from(content)
                : Buffer.from(content, 'utf8');
              const file = new MemFile(parsed.name, buffer, parsed.dir);
              parsed.dir.addChild(file);
            }
          } catch (error: any) {
            console.warn(`Failed to populate file ${memPath}:`, error.message);
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ==================== UTILITIES ====================

  private toVFSPath(memPath: string): string {
    if (memPath === '/') {
      return this.baseDirectory;
    }
    return path.join(this.baseDirectory, memPath);
  }

  getStatistics(): VFSMemFS2Statistics {
    let cachedFiles = 0;
    let totalFiles = 0;
    let totalDirectories = 0;

    const countNodes = (node: MemFile | MemDirectory): void => {
      if (node.isFile()) {
        totalFiles++;
        if (!this.dirtyPaths.has(node.getPath())) {
          cachedFiles++;
        }
      } else if (node.isDirectory()) {
        totalDirectories++;
        for (const child of (node as MemDirectory).listChildren()) {
          countNodes(child as MemFile | MemDirectory);
        }
      }
    };

    for (const child of this.root.listChildren()) {
      countNodes(child as MemFile | MemDirectory);
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

  isDirty(pathStr: string): boolean {
    return this.dirtyPaths.has(pathStr);
  }

  markDirty(pathStr: string): void {
    this.dirtyPaths.add(pathStr);
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
