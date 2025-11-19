import { MemSession } from './MemSession';
import { VFSClient } from './VFSMemFS';

export interface VFSMemSessionOptions {
  vfs?: VFSClient;
  baseDirectory?: string;
  persistToVFS?: boolean;
  autoSave?: boolean;
  saveInterval?: number; // milliseconds
}

export interface SessionData {
  id: string;
  createdAt: Date;
  history: string[];
  env: Record<string, string>;
  cwd: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced MemSession with VFS persistence capabilities
 * Provides automatic session saving and loading from VFS
 */
export class VFSMemSession extends MemSession {
  private vfs?: VFSClient;
  private baseDirectory?: string;
  private persistToVFS: boolean;
  private autoSave: boolean;
  private saveInterval: number;
  private autoSaveTimer?: NodeJS.Timeout;
  private lastSaved?: Date;

  constructor(options: VFSMemSessionOptions = {}) {
    super();
    this.vfs = options.vfs;
    this.baseDirectory = options.baseDirectory;
    this.persistToVFS = options.persistToVFS ?? false;
    this.autoSave = options.autoSave ?? false;
    this.saveInterval = options.saveInterval ?? 30000; // 30 seconds default

    if (this.persistToVFS && this.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Save session data to VFS
   */
  async saveToVFS(): Promise<boolean> {
    if (!this.vfs || !this.baseDirectory) {
      return false;
    }

    try {
      const sessionData: SessionData = {
        id: this.getId(),
        createdAt: this.getCreatedAt(),
        history: this.getHistory(),
        env: this.getAllEnv(),
        cwd: this.getCwd(),
        metadata: {
          lastSaved: new Date(),
          version: '1.0'
        }
      };

      const sessionPath = `${this.baseDirectory}/sessions/${this.getId()}.json`;
      
      // Ensure sessions directory exists
      const sessionsDir = `${this.baseDirectory}/sessions`;
      await this.vfs.mkdir(sessionsDir, { recursive: true });
      
      // Write session data as JSON
      const jsonData = JSON.stringify(sessionData, null, 2);
      await this.vfs.writeFileText(sessionPath, jsonData);
      
      this.lastSaved = new Date();
      return true;
    } catch (error: any) {
      console.warn(`Failed to save session ${this.getId()} to VFS:`, error);
      return false;
    }
  }

  /**
   * Load session data from VFS
   */
  async loadFromVFS(sessionId: string): Promise<boolean> {
    if (!this.vfs || !this.baseDirectory) {
      return false;
    }

    try {
      const sessionPath = `${this.baseDirectory}/sessions/${sessionId}.json`;
      const sessionDataStr = await this.vfs.readFile(sessionPath, 'utf8');
      const sessionData: SessionData = JSON.parse(sessionDataStr as string);

      // Validate session data structure
      if (!sessionData.id || !sessionData.history || !sessionData.env || !sessionData.cwd) {
        throw new Error('Invalid session data structure');
      }

      // Restore session state
      this.setEnvVars(sessionData.env);
      this.setCwd(sessionData.cwd);
      
      // Restore history
      this.clearHistory();
      for (const command of sessionData.history) {
        this.addCommand(command);
      }

      this.lastSaved = sessionData.metadata?.lastSaved ? new Date(sessionData.metadata.lastSaved) : undefined;
      return true;
    } catch (error) {
      console.warn(`Failed to load session ${sessionId} from VFS:`, error);
      return false;
    }
  }

  /**
   * List all available sessions in VFS
   */
  async listVFSSessions(): Promise<string[]> {
    if (!this.vfs || !this.baseDirectory) {
      return [];
    }

    try {
      const sessionsDir = `${this.baseDirectory}/sessions`;
      const entries = await this.vfs.readdir(sessionsDir, { withFileTypes: true });
      
      return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => entry.name.replace('.json', ''));
    } catch (error: any) {
      // Sessions directory might not exist yet
      if (error.toString().includes('ENOENT')) {
        return [];
      }
      console.warn('Failed to list VFS sessions:', error);
      return [];
    }
  }

  /**
   * Delete a session from VFS
   */
  async deleteVFSSession(sessionId: string): Promise<boolean> {
    if (!this.vfs || !this.baseDirectory) {
      return false;
    }

    try {
      const sessionPath = `${this.baseDirectory}/sessions/${sessionId}.json`;
      await this.vfs.unlink(sessionPath);
      return true;
    } catch (error) {
      console.warn(`Failed to delete session ${sessionId} from VFS:`, error);
      return false;
    }
  }

  /**
   * Get session info including VFS persistence status
   */
  getVFSInfo(): {
    id: string;
    createdAt: Date;
    historySize: number;
    envVarCount: number;
    cwd: string;
    persistToVFS: boolean;
    autoSave: boolean;
    lastSaved?: Date;
    baseDirectory?: string;
  } {
    const baseInfo = this.getInfo();
    return {
      ...baseInfo,
      persistToVFS: this.persistToVFS,
      autoSave: this.autoSave,
      lastSaved: this.lastSaved,
      baseDirectory: this.baseDirectory
    };
  }

  /**
   * Enable VFS persistence
   */
  enableVFSPersistence(baseDirectory: string, vfs: VFSClient, autoSave: boolean = false): void {
    this.baseDirectory = baseDirectory;
    this.vfs = vfs;
    this.persistToVFS = true;
    this.autoSave = autoSave;

    if (autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Disable VFS persistence
   */
  disableVFSPersistence(): void {
    this.stopAutoSave();
    this.persistToVFS = false;
    this.autoSave = false;
    this.vfs = undefined;
    this.baseDirectory = undefined;
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      this.stopAutoSave();
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.persistToVFS) {
        this.saveToVFS().catch(error => {
          console.warn('Auto-save failed:', error);
        });
      }
    }, this.saveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Override addCommand to trigger auto-save
   */
  addCommand(command: string): void {
    super.addCommand(command);
    
    // Trigger save after command is added (if auto-save is enabled)
    if (this.persistToVFS && this.autoSave) {
      // Debounce saves to avoid too frequent writes
      if (this.autoSaveTimer) {
        this.stopAutoSave();
        setTimeout(() => this.startAutoSave(), 1000);
      }
    }
  }

  /**
   * Override setEnv to trigger auto-save
   */
  setEnv(key: string, value: string): void {
    super.setEnv(key, value);
    
    if (this.persistToVFS && this.autoSave) {
      this.saveToVFS().catch(error => {
        console.warn('Environment save failed:', error);
      });
    }
  }

  /**
   * Override setCwd to trigger auto-save
   */
  setCwd(path: string): void {
    super.setCwd(path);
    
    if (this.persistToVFS && this.autoSave) {
      this.saveToVFS().catch(error => {
        console.warn('Working directory save failed:', error);
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoSave();
    
    // Final save if persistence is enabled
    if (this.persistToVFS) {
      this.saveToVFS().catch(error => {
        console.warn('Final session save failed:', error);
      });
    }
  }
}