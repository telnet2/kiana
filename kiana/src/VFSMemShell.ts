import { MemShell } from './MemShell';
import { VFSMemFS, VFSClient } from './VFSMemFS';
import { MemSession } from './MemSession';

export interface VFSMemShellOptions {
  vfs: VFSClient;
  baseDirectory: string;
  writeMode: 'sync' | 'flush';
  session?: MemSession;
}

export interface VFSStatus {
  writeMode: 'sync' | 'flush';
  dirtyFiles: number;
  cachedFiles: number;
  totalFiles: number;
  syncInProgress: boolean;
  lastSyncTime?: Date;
  baseDirectory: string;
}

/**
 * Enhanced MemShell with VFS integration
 * Provides shell interface with VFS-backed file system and persistence
 */
export class VFSMemShell extends MemShell {
  private vfs: VFSClient;
  private baseDirectory: string;
  private vfsMemFS: VFSMemFS;

  constructor(options: VFSMemShellOptions) {
    // Create VFSMemFS instance first
    const vfsMemFS = new VFSMemFS({
      vfs: options.vfs,
      baseDirectory: options.baseDirectory,
      writeMode: options.writeMode,
      prePopulate: true // Pre-populate from VFS on startup
    });

    // Initialize parent MemShell with VFSMemFS
    super(vfsMemFS, options.session);
    
    this.vfs = options.vfs;
    this.baseDirectory = options.baseDirectory;
    this.vfsMemFS = vfsMemFS;
  }

  /**
   * Override exec to add VFS-specific commands
   */
  exec(commandLine: string): string {
    const trimmedCommand = commandLine.trim();
    
    // Handle VFS-specific commands
    if (trimmedCommand === 'vfs-sync') {
      return this.handleVFSSync();
    }
    
    if (trimmedCommand === 'vfs-status') {
      return this.handleVFSStatus();
    }
    
    if (trimmedCommand === 'vfs-flush') {
      return this.handleVFSFlush();
    }
    
    if (trimmedCommand === 'vfs-stats') {
      return this.handleVFSStats();
    }
    
    if (trimmedCommand.startsWith('vfs-mode ')) {
      return this.handleVFSMode(trimmedCommand);
    }
    
    if (trimmedCommand.startsWith('vfs-cache ')) {
      return this.handleVFSCache(trimmedCommand);
    }
    
    // Fall back to regular MemShell execution
    try {
      return super.exec(commandLine);
    } catch (error: any) {
      // Enhance error messages with VFS context
      if (error.message.includes('VFS sync failed')) {
        return `VFS Error: ${error.message}\nBase Directory: ${this.baseDirectory}`;
      }
      throw error;
    }
  }

  /**
   * Handle vfs-sync command - sync all dirty files to VFS
   */
  private handleVFSSync(): string {
    try {
      // Use Promise-based approach but return synchronous response
      this.vfsMemFS.flush().then(() => {
        // Sync completed successfully
      }).catch((error: any) => {
        console.error('VFS sync failed:', error);
      });
      
      return 'VFS sync initiated. Use "vfs-status" to check progress.';
    } catch (error: any) {
      return `VFS sync error: ${error.message}`;
    }
  }

  /**
   * Handle vfs-status command - show VFS synchronization status
   */
  private handleVFSStatus(): string {
    const stats = this.vfsMemFS.getStatistics();
    const dirtyPaths = this.vfsMemFS.getDirtyPaths();
    
    let status = `VFS Status (${this.baseDirectory}):
`;
    status += `Write Mode: ${this.vfsMemFS.getWriteMode()}
`;
    status += `Dirty Files: ${stats.dirtyFiles}
`;
    status += `Cached Files: ${stats.cachedFiles}
`;
    status += `Total Files: ${stats.totalFiles}
`;
    status += `Sync In Progress: ${stats.syncInProgress ? 'Yes' : 'No'}
`;
    
    if (stats.lastSyncTime) {
      status += `Last Sync: ${stats.lastSyncTime.toLocaleString()}
`;
    }
    
    if (dirtyPaths.length > 0) {
      status += `\nDirty Files (${dirtyPaths.length}):
`;
      dirtyPaths.slice(0, 10).forEach(p => status += `  ${p}\n`);
      if (dirtyPaths.length > 10) {
        status += `  ... and ${dirtyPaths.length - 10} more\n`;
      }
    }
    
    return status.trim();
  }

  /**
   * Handle vfs-flush command - flush all dirty files to VFS
   */
  private handleVFSFlush(): string {
    const stats = this.vfsMemFS.getStatistics();
    if (stats.dirtyFiles === 0) {
      return 'No dirty files to flush.';
    }
    
    try {
      this.vfsMemFS.flush().then(() => {
        console.log('VFS flush completed');
      }).catch((error: any) => {
        console.error('VFS flush failed:', error);
      });
      
      return `Flushing ${stats.dirtyFiles} dirty files to VFS...`;
    } catch (error: any) {
      return `VFS flush error: ${error.message}`;
    }
  }

  /**
   * Handle vfs-stats command - show detailed VFS statistics
   */
  private handleVFSStats(): string {
    const stats = this.vfsMemFS.getStatistics();
    
    return `VFS Statistics:
  Base Directory: ${this.baseDirectory}
  Write Mode: ${this.vfsMemFS.getWriteMode()}
  Cache on Read: ${this.vfsMemFS.isCacheOnRead() ? 'Enabled' : 'Disabled'}
  
  File Statistics:
    Total Files: ${stats.totalFiles}
    Cached Files: ${stats.cachedFiles}
    Dirty Files: ${stats.dirtyFiles}
    Sync Efficiency: ${stats.totalFiles > 0 ? Math.round((stats.cachedFiles / stats.totalFiles) * 100) : 100}%
  
  Sync Status:
    In Progress: ${stats.syncInProgress ? 'Yes' : 'No'}
    Last Sync: ${stats.lastSyncTime ? stats.lastSyncTime.toLocaleString() : 'Never'}
  
  Performance:
    Memory-First Operations: Enabled
    VFS Persistence: ${this.vfsMemFS.getWriteMode() === 'sync' ? 'Real-time' : 'Batch'}
`;
  }

  /**
   * Handle vfs-mode command - change write mode
   */
  private handleVFSMode(command: string): string {
    const parts = command.split(' ');
    if (parts.length !== 2) {
      return 'Usage: vfs-mode <sync|flush>';
    }
    
    const mode = parts[1].toLowerCase();
    if (mode !== 'sync' && mode !== 'flush') {
      return 'Invalid mode. Use "sync" or "flush".';
    }
    
    const currentMode = this.vfsMemFS.getWriteMode();
    this.vfsMemFS.setWriteMode(mode as 'sync' | 'flush');
    
    return `VFS write mode changed from ${currentMode} to ${mode}`;
  }

  /**
   * Handle vfs-cache command - manage cache settings
   */
  private handleVFSCache(command: string): string {
    const parts = command.split(' ');
    if (parts.length < 2) {
      return 'Usage: vfs-cache <on|off|status>';
    }
    
    const subcommand = parts[1].toLowerCase();
    
    switch (subcommand) {
      case 'on':
        this.vfsMemFS.setCacheOnRead(true);
        return 'VFS cache on read: Enabled';
        
      case 'off':
        this.vfsMemFS.setCacheOnRead(false);
        return 'VFS cache on read: Disabled';
        
      case 'status':
        const enabled = this.vfsMemFS.isCacheOnRead();
        return `VFS cache on read: ${enabled ? 'Enabled' : 'Disabled'}`;
        
      default:
        return 'Invalid cache command. Use "on", "off", or "status".';
    }
  }

  /**
   * Get current VFS status information
   */
  getVFSStatus(): VFSStatus {
    const stats = this.vfsMemFS.getStatistics();
    return {
      writeMode: this.vfsMemFS.getWriteMode(),
      dirtyFiles: stats.dirtyFiles,
      cachedFiles: stats.cachedFiles,
      totalFiles: stats.totalFiles,
      syncInProgress: stats.syncInProgress,
      lastSyncTime: stats.lastSyncTime,
      baseDirectory: this.baseDirectory
    };
  }

  /**
   * Force sync all dirty files to VFS
   */
  async syncToVFS(): Promise<void> {
    await this.vfsMemFS.flush();
  }

  /**
   * Get the underlying VFSMemFS instance
   */
  getVFSMemFS(): VFSMemFS {
    return this.vfsMemFS;
  }

  /**
   * Get the VFS client
   */
  getVFSClient(): VFSClient {
    return this.vfs;
  }

  /**
   * Get the base directory
   */
  getBaseDirectory(): string {
    return this.baseDirectory;
  }

  /**
   * Change write mode
   */
  setWriteMode(mode: 'sync' | 'flush'): void {
    this.vfsMemFS.setWriteMode(mode);
  }

  /**
   * Get current write mode
   */
  getWriteMode(): 'sync' | 'flush' {
    return this.vfsMemFS.getWriteMode();
  }

  /**
   * Enable/disable cache on read
   */
  setCacheOnRead(enabled: boolean): void {
    this.vfsMemFS.setCacheOnRead(enabled);
  }

  /**
   * Check if cache on read is enabled
   */
  isCacheOnRead(): boolean {
    return this.vfsMemFS.isCacheOnRead();
  }
}