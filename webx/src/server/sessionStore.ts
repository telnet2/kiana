import { MemTools } from '@byted/kiana';

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
