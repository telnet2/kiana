import { MemFS, MemFile, MemDirectory, MemNode } from './MemFS';
import * as path from 'path';

// VFS interface types (minimal subset needed for integration)
export interface VFSClient {
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void>;
  writeFileText(path: string, text: string, options?: any): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<any[]>;
  stat(path: string): Promise<any>;
  unlink(path: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface VFSMemFSOptions {
  vfs: VFSClient;
  baseDirectory: string;
  writeMode: 'sync' | 'flush';
  prePopulate?: boolean;
  cacheOnRead?: boolean;
}

export interface VFSMemFSStatistics {
  dirtyFiles: number;
  cachedFiles: number;
  totalFiles: number;
  syncInProgress: boolean;
  lastSyncTime?: Date;
}

export class VFSMemFS extends MemFS {
  private vfs: VFSClient;
  private baseDirectory: string;
  private writeMode: 'sync' | 'flush';
  private cacheOnRead: boolean;
  private dirtyPaths: Set<string> = new Set();
  private syncInProgress: boolean = false;
  private lastSyncTime?: Date;

  constructor(options: VFSMemFSOptions) {
    super();
    this.vfs = options.vfs;
    this.baseDirectory = options.baseDirectory;
    this.writeMode = options.writeMode;
    this.cacheOnRead = options.cacheOnRead ?? true;
    
    if (options.prePopulate) {
      // Pre-populate asynchronously to avoid blocking constructor
      this.prePopulateFromVFS().catch(error => {
        console.warn('Failed to pre-populate from VFS:', error);
      });
    }
  }

  // Override file creation to handle VFS sync
  createFile(pathStr: string, content = ''): MemFile {
    const file = super.createFile(pathStr, content);
    
    if (this.writeMode === 'sync') {
      // Sync asynchronously to avoid blocking file creation
      this.syncFileToVFS(pathStr).catch(error => {
        console.error(`Failed to sync ${pathStr} to VFS:`, error);
      });
    } else {
      this.dirtyPaths.add(pathStr);
    }
    
    return file;
  }

  // Override file writing to handle VFS sync
  writeFile(pathStr: string, content: string): void {
    const node = this.resolvePath(pathStr);
    if (node?.isFile()) {
      node.write(content);
    } else {
      this.createFile(pathStr, content);
      return; // createFile already handles sync
    }
    
    if (this.writeMode === 'sync') {
      this.syncFileToVFS(pathStr).catch(error => {
        console.error(`Failed to sync ${pathStr} to VFS:`, error);
      });
    } else {
      this.dirtyPaths.add(pathStr);
    }
  }

  // Override file appending to handle VFS sync
  appendFile(pathStr: string, content: string): void {
    const node = this.resolvePath(pathStr);
    if (!node?.isFile()) {
      throw new Error(`No such file: ${pathStr}`);
    }
    
    node.append(content);
    
    if (this.writeMode === 'sync') {
      this.syncFileToVFS(pathStr).catch(error => {
        console.error(`Failed to sync ${pathStr} to VFS:`, error);
      });
    } else {
      this.dirtyPaths.add(pathStr);
    }
  }

  // Override directory creation to handle VFS sync
  createDirectory(pathStr: string): MemDirectory {
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

  // Override file removal to handle VFS sync
  remove(pathStr: string, recursive = false): boolean {
    const result = super.remove(pathStr, recursive);
    
    if (result && this.writeMode === 'sync') {
      const vfsPath = this.toVFSPath(pathStr);
      this.vfs.unlink(vfsPath).catch(error => {
        console.error(`Failed to remove ${pathStr} from VFS:`, error);
      });
    } else if (result) {
      this.dirtyPaths.add(pathStr);
    }
    
    return result;
  }

  // VFS synchronization methods
  private async syncFileToVFS(pathStr: string): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (!node?.isFile()) return;

    const vfsPath = this.toVFSPath(pathStr);
    const content = node.read();
    
    try {
      // Ensure parent directory exists in VFS
      const parentDir = path.dirname(vfsPath);
      if (parentDir !== '/') {
        await this.vfs.mkdir(parentDir, { recursive: true });
      }
      
      await this.vfs.writeFileText(vfsPath, content);
      this.dirtyPaths.delete(pathStr);
      this.lastSyncTime = new Date();
    } catch (error: any) {
      console.error(`Failed to sync ${pathStr} to VFS:`, error);
      throw new Error(`VFS sync failed for ${pathStr}: ${error.message || error}`);
    }
  }

  // Flush all dirty files to VFS
  async flush(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const paths = Array.from(this.dirtyPaths);
      const promises = paths.map(path => this.syncPathToVFS(path));
      await Promise.allSettled(promises);
    } finally {
      this.syncInProgress = false;
      this.lastSyncTime = new Date();
    }
  }

  // Sync a path and all its contents to VFS
  private async syncPathToVFS(pathStr: string): Promise<void> {
    const node = this.resolvePath(pathStr);
    if (!node) return;

    if (node.isFile()) {
      await this.syncFileToVFS(pathStr);
    } else if (node.isDirectory()) {
      await this.syncDirectoryToVFS(pathStr);
    }
  }

  // Sync directory contents to VFS
  private async syncDirectoryToVFS(dirPath: string): Promise<void> {
    const node = this.resolvePath(dirPath);
    if (!node?.isDirectory()) return;

    const vfsPath = this.toVFSPath(dirPath);
    
    try {
      // Ensure directory exists in VFS
      if (vfsPath !== '/') {
        await this.vfs.mkdir(vfsPath, { recursive: true });
      }
      
      // Sync all children
      const children = node.listChildren();
      const promises = children.map(child => {
        const childPath = path.join(dirPath, child.name);
        return this.syncPathToVFS(childPath);
      });
      
      await Promise.allSettled(promises);
      this.dirtyPaths.delete(dirPath);
    } catch (error) {
      console.error(`Failed to sync directory ${dirPath} to VFS:`, error);
    }
  }

  // Pre-population from VFS
  private async prePopulateFromVFS(): Promise<void> {
    try {
      await this.populateDirectory('/');
    } catch (error) {
      console.warn('Failed to pre-populate from VFS:', error);
    }
  }

  // Recursively populate directory from VFS
  private async populateDirectory(dirPath: string): Promise<void> {
    const vfsPath = this.toVFSPath(dirPath);
    
    try {
      const entries = await this.vfs.readdir(vfsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const memPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Create directory in MemFS
          try {
            this.createDirectory(memPath);
          } catch (error) {
            // Directory might already exist, continue
          }
          // Recursively populate subdirectory
          await this.populateDirectory(memPath);
        } else if (entry.isFile()) {
          try {
            // Read file content from VFS
            const content = await this.vfs.readFile(path.join(vfsPath, entry.name), 'utf8');
            // Create file in MemFS
            this.createFile(memPath, content as string);
          } catch (error) {
            console.warn(`Failed to populate file ${memPath} from VFS:`, error);
          }
        }
      }
    } catch (error: any) {
      // Directory might not exist in VFS, which is fine for initial setup
      if (!error.toString().includes('ENOENT')) {
        console.warn(`Failed to populate directory ${dirPath} from VFS:`, error);
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

  private fromVFSPath(vfsPath: string): string {
    if (vfsPath === this.baseDirectory) {
      return '/';
    }
    if (vfsPath.startsWith(this.baseDirectory)) {
      const relativePath = vfsPath.slice(this.baseDirectory.length);
      return relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    }
    return vfsPath;
  }

  // Get statistics about VFS sync state
  getStatistics(): VFSMemFSStatistics {
    let cachedFiles = 0;
    let totalFiles = 0;

    const countFiles = (node: MemNode): void => {
      totalFiles++;
      if (node.isFile() && !this.dirtyPaths.has(node.getPath())) {
        cachedFiles++;
      }
      if (node.isDirectory()) {
        for (const child of (node as MemDirectory).listChildren()) {
          countFiles(child);
        }
      }
    };

    for (const child of this.root.listChildren()) {
      countFiles(child);
    }

    return {
      dirtyFiles: this.dirtyPaths.size,
      cachedFiles,
      totalFiles,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime
    };
  }

  // Check if a path is dirty (needs sync)
  isDirty(pathStr: string): boolean {
    return this.dirtyPaths.has(pathStr);
  }

  // Get all dirty paths
  getDirtyPaths(): string[] {
    return Array.from(this.dirtyPaths);
  }

  // Clear dirty state for a specific path
  clearDirty(pathStr: string): void {
    this.dirtyPaths.delete(pathStr);
  }

  // Clear all dirty states
  clearAllDirty(): void {
    this.dirtyPaths.clear();
  }

  // Change write mode dynamically
  setWriteMode(mode: 'sync' | 'flush'): void {
    this.writeMode = mode;
  }

  // Get current write mode
  getWriteMode(): 'sync' | 'flush' {
    return this.writeMode;
  }

  // Enable/disable cache on read
  setCacheOnRead(enabled: boolean): void {
    this.cacheOnRead = enabled;
  }

  // Check if cache on read is enabled
  isCacheOnRead(): boolean {
    return this.cacheOnRead;
  }
}