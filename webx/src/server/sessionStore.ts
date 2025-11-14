'use server';

import { createMemTools } from '@byted/kiana';
import type { MemTools } from '@byted/kiana';

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
    const memtools = createMemTools();
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

let store: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!store) {
    store = new SessionStore();
  }
  return store;
}
