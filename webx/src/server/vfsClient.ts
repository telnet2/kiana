/**
 * VFS Client Adapter
 * Implements VFSClient2 interface for crystal-vfs backend
 *
 * This is a re-export of the VFSClient2 interface and adapter from kiana
 * to avoid duplication and maintain consistency.
 */

export interface VFSClient2 {
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void>;
  writeFileText(path: string, text: string, options?: any): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | VFSDirectoryEntry[]>;
  stat(path: string): Promise<VFSFileStat>;
  unlink(path: string): Promise<void>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface VFSFileStat {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  ctime: Date;
}

export interface VFSDirectoryEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

/**
 * VFS Client implementation using crystal-vfs
 * Dynamically imports the VFS client from @byted/crystal-vfs package
 */
export class VFSClientAdapter implements VFSClient2 {
  private vfs: any; // crystal-vfs instance

  constructor(baseURL: string, token: string) {
    try {
      // Try to load the VFS class from dynamic require
      // It's installed as a peer dependency in kiana
      const vfsModule = (require as any)('@byted/crystal-vfs');
      const VFSClass = vfsModule.VFS || vfsModule.default;
      this.vfs = new VFSClass({
        baseURL,
        token,
      });
    } catch (error) {
      console.warn('⚠️  @byted/crystal-vfs not available, using mock VFS for development');
      // Fall back gracefully - return a mock VFS that logs warnings
      this.vfs = this.createMockVFS();
    }
  }

  private createMockVFS() {
    console.warn('⚠️  Running with mock VFS - @byted/crystal-vfs not available');
    console.warn('⚠️  Files will NOT be persisted to external VFS');
    return {
      readFile: async () => { throw new Error('Mock VFS not configured'); },
      writeFile: async () => { console.warn('Mock VFS: writeFile called but not implemented'); },
      writeFileText: async () => { console.warn('Mock VFS: writeFileText called but not implemented'); },
      mkdir: async () => { console.warn('Mock VFS: mkdir called but not implemented'); },
      readdir: async () => [],
      stat: async () => { throw new Error('Mock VFS not configured'); },
      unlink: async () => { console.warn('Mock VFS: unlink called but not implemented'); },
      rm: async () => { console.warn('Mock VFS: rm called but not implemented'); },
    };
  }

  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    return this.vfs.readFile(path, encoding);
  }

  async writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void> {
    return this.vfs.writeFile(path, data, options);
  }

  async writeFileText(path: string, text: string, options?: any): Promise<void> {
    return this.vfs.writeFileText(path, text, options);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.vfs.mkdir(path, options);
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | VFSDirectoryEntry[]> {
    return this.vfs.readdir(path, options);
  }

  async stat(path: string): Promise<VFSFileStat> {
    return this.vfs.stat(path);
  }

  async unlink(path: string): Promise<void> {
    return this.vfs.unlink(path);
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.vfs.rm(path, options);
  }
}

/**
 * Get VFS client instance (singleton)
 */
let vfsClientInstance: VFSClient2 | null = null;

export function getVFSClient(): VFSClient2 {
  if (!vfsClientInstance) {
    const baseURL = process.env.VFS_BASE_URL || 'http://localhost:18080';
    const token = process.env.VFS_AUTH_TOKEN || 'local-system-admin';
    vfsClientInstance = new VFSClientAdapter(baseURL, token);
  }
  return vfsClientInstance;
}
