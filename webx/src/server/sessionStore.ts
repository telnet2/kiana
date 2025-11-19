import { MemTools, DEFAULT_SYSTEM_PROMPT } from '@byted/kiana';

interface SessionRecord {
  id: string;
  memtools: MemTools;
  createdAt: Date;
}

class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  list(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  create(): SessionRecord {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const memtools = new MemTools();

    // Seed the default system prompt as _system_prompt file
    try {
      const fs = memtools.getFileSystem();
      fs.createFile('/_system_prompt', DEFAULT_SYSTEM_PROMPT);
    } catch (e) {
      // If file creation fails, continue without it - the chat route will use the default
      console.error('Failed to seed _system_prompt file:', e);
    }

    const record: SessionRecord = {
      id,
      memtools,
      createdAt: new Date(),
    };
    this.sessions.set(id, record);
    return record;
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
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
