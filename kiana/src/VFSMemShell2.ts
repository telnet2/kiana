/**
 * VFSMemShell2 - MemShell with VFSMemFS2 Integration
 *
 * Extends MemShell to work with VFSMemFS2 for VFS persistence.
 * Uses sync API of VFSMemFS2 to maintain MemShell's synchronous exec() interface.
 */

import { MemShell } from './MemShell';
import { MemSession } from './MemSession';
import { VFSMemFS2, VFSClient2 } from './VFSMemFS2';
import { MemFile, MemDirectory } from './MemFS';

export interface VFSMemShell2Options {
  vfs: VFSClient2;
  baseDirectory: string;
  writeMode: 'sync' | 'flush';
  session?: MemSession;
}

export class VFSMemShell2 extends MemShell {
  private vfsMemFS2: VFSMemFS2;
  private lastExecutionTime: number = 0;

  constructor(options: VFSMemShell2Options) {
    // Create VFSMemFS2 and pass to MemShell parent
    const vfsMemFS2 = new VFSMemFS2({
      vfs: options.vfs,
      baseDirectory: options.baseDirectory,
      writeMode: options.writeMode,
      cacheOnRead: true
    });

    // Initialize parent MemShell with VFSMemFS2 as the file system
    super(vfsMemFS2, options.session);

    this.vfsMemFS2 = vfsMemFS2;

    // Register VFS-specific commands
    this.registerVFSCommands();
  }

  private registerVFSCommands(): void {
    // These will be added to the parent MemShell's command registry
    // For now, we'll expose them through methods
  }

  /**
   * Override exec to track file modifications
   */
  override exec(command: string): string {
    this.lastExecutionTime = Date.now();
    const result = super.exec(command);
    this.trackModifiedFiles();
    return result;
  }

  /**
   * Scan the file system and mark recently modified files as dirty
   */
  private trackModifiedFiles(): void {
    const walkAndTrack = (node: MemFile | MemDirectory, basePath: string = ''): void => {
      const nodePath = basePath + '/' + node.name;

      if (node.isFile()) {
        // Check if file was modified since last execution
        if (node.modifiedAt.getTime() > this.lastExecutionTime - 100) {
          // Mark as dirty if not already tracked
          if (!this.vfsMemFS2.isDirty(nodePath)) {
            this.vfsMemFS2.markDirty(nodePath);
          }
        }
      } else if (node.isDirectory()) {
        const dir = node as MemDirectory;
        for (const child of dir.listChildren()) {
          walkAndTrack(child as MemFile | MemDirectory, nodePath);
        }
      }
    };

    // Walk the root file system
    const root = this.fs.root as MemDirectory;
    for (const child of root.listChildren()) {
      walkAndTrack(child as MemFile | MemDirectory);
    }
  }

  // ==================== VFS OPERATIONS ====================

  /**
   * Flush all dirty files to VFS
   */
  async flush(): Promise<void> {
    return this.vfsMemFS2.flush();
  }

  /**
   * Flush a single file to VFS (or remove if deleted)
   */
  async flushFile(pathStr: string): Promise<void> {
    return this.vfsMemFS2.flushFile(pathStr);
  }

  /**
   * Pre-populate memory file system from VFS
   */
  async prePopulate(): Promise<void> {
    return this.vfsMemFS2.prePopulate();
  }

  /**
   * Set write mode (sync or flush)
   */
  setWriteMode(mode: 'sync' | 'flush'): void {
    this.vfsMemFS2.setWriteMode(mode);
  }

  /**
   * Get current write mode
   */
  getWriteMode(): 'sync' | 'flush' {
    return this.vfsMemFS2.getWriteMode();
  }

  /**
   * Get VFS statistics
   */
  getVFSStats() {
    return this.vfsMemFS2.getStatistics();
  }

  /**
   * Get VFS status as formatted string
   */
  getVFSStatus(): string {
    const stats = this.vfsMemFS2.getStatistics();
    return `
VFS Status:
  Base Directory: ${this.vfsMemFS2.getBaseDirectory()}
  Write Mode: ${this.getWriteMode()}
  Dirty Files: ${stats.dirtyFiles}
  Deleted Files: ${stats.deletedFiles}
  Cached Files: ${stats.cachedFiles}
  Total Files: ${stats.totalFiles}
  Total Directories: ${stats.totalDirectories}
  Sync In Progress: ${stats.syncInProgress}
  Last Sync Time: ${stats.lastSyncTime ? stats.lastSyncTime.toISOString() : 'Never'}
    `.trim();
  }

  /**
   * Get dirty paths
   */
  getDirtyPaths(): string[] {
    return this.vfsMemFS2.getDirtyPaths();
  }

  /**
   * Get deleted paths
   */
  getDeletedPaths(): string[] {
    return this.vfsMemFS2.getDeletedPaths();
  }

  /**
   * Get VFS client for direct access if needed
   */
  getVFSMemFS2(): VFSMemFS2 {
    return this.vfsMemFS2;
  }
}
