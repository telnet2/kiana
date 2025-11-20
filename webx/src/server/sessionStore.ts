import { ulid } from 'ulid';
import { VFSMemShell2 } from '@byted/kiana';
import { DEFAULT_SYSTEM_PROMPT } from '@byted/kiana';
import { getVFSClient } from './vfsClient';

export interface SessionData {
  id: string;
  createdAt: string;
  workingDir: string;
  history: Array<{
    command: string;
    output: string;
    timestamp: string;
  }>;
}

export interface SessionRecord {
  id: string;
  shell: VFSMemShell2;
  createdAt: Date;
  workingDir: string;
  history: Array<{
    command: string;
    output: string;
    timestamp: string;
  }>;
}

class SessionStore {
  private sessions = new Map<string, SessionRecord>();
  private initialized = false;

  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  list(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const vfs = getVFSClient();
      // Try to load existing sessions from /sessions directory
      try {
        const entries = await vfs.readdir('/sessions', { withFileTypes: true });
        for (const entry of entries) {
          if (typeof entry !== 'string' && entry.isFile() && entry.name.endsWith('.json')) {
            try {
              const sessionPath = `/sessions/${entry.name}`;
              const content = await vfs.readFile(sessionPath, 'utf8');
              const sessionData = JSON.parse(content as string) as SessionData;
              await this.restoreSession(sessionData);
            } catch (error) {
              console.warn(`Failed to restore session ${entry.name}:`, error);
            }
          }
        }
      } catch (error: any) {
        // /sessions directory may not exist yet, that's fine
        if (error.code !== 'ENOENT') {
          console.warn('Failed to read sessions directory:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize session store:', error);
    }

    this.initialized = true;
  }

  async create(): Promise<SessionRecord> {
    const id = ulid();
    const vfs = getVFSClient();
    const baseDir = `/kiana/session-${id}`;

    // Create base directory for this session
    try {
      await vfs.mkdir(baseDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create session directory ${baseDir}:`, error);
    }

    // Create VFSMemShell2 instance
    const shell = new VFSMemShell2({
      vfs,
      baseDirectory: baseDir,
      writeMode: 'flush',
    });

    // Seed the default system prompt
    try {
      shell.exec(`cat > /_system_prompt << 'EOF'\n${DEFAULT_SYSTEM_PROMPT}\nEOF`);
    } catch (error) {
      console.warn('Failed to seed _system_prompt file:', error);
    }

    const record: SessionRecord = {
      id,
      shell,
      createdAt: new Date(),
      workingDir: '/',
      history: [],
    };

    this.sessions.set(id, record);

    // Save session metadata to VFS
    await this.persistSession(record);

    return record;
  }

  private async restoreSession(sessionData: SessionData): Promise<void> {
    const vfs = getVFSClient();
    const baseDir = `/kiana/session-${sessionData.id}`;

    // Create VFSMemShell2 instance
    const shell = new VFSMemShell2({
      vfs,
      baseDirectory: baseDir,
      writeMode: 'flush',
    });

    // Pre-populate files from VFS
    try {
      await shell.prePopulate();
    } catch (error) {
      console.warn(`Failed to prePopulate session ${sessionData.id}:`, error);
    }

    // Replay command history to restore shell state (environment, aliases, etc.)
    for (const historyItem of sessionData.history) {
      try {
        shell.exec(historyItem.command);
      } catch (error) {
        console.warn(`Failed to replay command "${historyItem.command}" in session ${sessionData.id}:`, error);
      }
    }

    // Restore working directory
    try {
      shell.exec(`cd "${sessionData.workingDir}"`);
    } catch (error) {
      console.warn(`Failed to restore working directory in session ${sessionData.id}:`, error);
    }

    const record: SessionRecord = {
      id: sessionData.id,
      shell,
      createdAt: new Date(sessionData.createdAt),
      workingDir: sessionData.workingDir,
      history: sessionData.history,
    };

    this.sessions.set(sessionData.id, record);
  }

  public async persistSession(record: SessionRecord): Promise<void> {
    try {
      const vfs = getVFSClient();
      await vfs.mkdir('/sessions', { recursive: true });

      const sessionData: SessionData = {
        id: record.id,
        createdAt: record.createdAt.toISOString(),
        workingDir: record.workingDir,
        history: record.history,
      };

      const sessionPath = `/sessions/session-${record.id}.json`;
      await vfs.writeFileText(sessionPath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error(`Failed to persist session ${record.id}:`, error);
    }
  }

  async updateHistory(id: string, command: string, output: string): Promise<void> {
    const record = this.sessions.get(id);
    if (!record) return;

    record.history.push({
      command,
      output,
      timestamp: new Date().toISOString(),
    });

    // Persist updated session
    await this.persistSession(record);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  async deleteWithCleanup(id: string): Promise<void> {
    const vfs = getVFSClient();

    // Remove session metadata file
    try {
      const sessionPath = `/sessions/session-${id}.json`;
      await vfs.unlink(sessionPath);
    } catch (error) {
      console.warn(`Failed to delete session metadata ${id}:`, error);
    }

    // Remove session directory and all its contents
    try {
      const sessionDir = `/kiana/session-${id}`;
      await vfs.rm(sessionDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to delete session directory ${id}:`, error);
    }

    // Remove from in-memory store
    this.sessions.delete(id);
  }
}

// Use globalThis to ensure singleton pattern survives module reloads in Next.js dev mode
declare global {
  var sessionStore: SessionStore | undefined;
}

export function getSessionStore(): SessionStore {
  if (!global.sessionStore) {
    global.sessionStore = new SessionStore();
  }
  return global.sessionStore;
}
