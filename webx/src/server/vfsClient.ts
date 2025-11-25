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
  private baseURL: string;
  private token: string;
  private initialized = false;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
    // Don't initialize in constructor, do it lazily on first use
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamically import crystal-vfs at runtime
      const vfsModule = await import('@byted/crystal-vfs');
      const VFSClass = vfsModule.VFS || (vfsModule as any).default?.VFS || (vfsModule as any).VFS;

      if (!VFSClass) {
        throw new Error('VFS class not found in @byted/crystal-vfs module');
      }

      this.vfs = new VFSClass({
        baseURL: this.baseURL,
        token: this.token,
      });
      console.log('✓ Crystal VFS initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Crystal VFS:', error);
      throw error;
    }
  }

  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    await this.ensureInitialized();
    return this.vfs.readFile(path, encoding);
  }

  async writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void> {
    await this.ensureInitialized();
    return this.vfs.writeFile(path, data, options);
  }

  async writeFileText(path: string, text: string, options?: any): Promise<void> {
    await this.ensureInitialized();
    return this.vfs.writeFileText(path, text, options);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ensureInitialized();
    return this.vfs.mkdir(path, options);
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | VFSDirectoryEntry[]> {
    await this.ensureInitialized();
    return this.vfs.readdir(path, options);
  }

  async stat(path: string): Promise<VFSFileStat> {
    await this.ensureInitialized();
    return this.vfs.stat(path);
  }

  async unlink(path: string): Promise<void> {
    await this.ensureInitialized();
    return this.vfs.unlink(path);
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ensureInitialized();
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
