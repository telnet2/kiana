import { MemTools, DEFAULT_SYSTEM_PROMPT } from '@byted/kiana';

export type SessionRecord = {
  id: string;
  name?: string;
  createdAt: number;
  memtools: MemTools;
  messages: { role: 'user' | 'assistant'; content: string; ts: number }[];
};

class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  create(name?: string) {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const memtools = new MemTools();
    try {
      // Seed system prompt file for the session
      memtools.getFileSystem().createFile('/_system_prompt', DEFAULT_SYSTEM_PROMPT);
    } catch {}
    const rec: SessionRecord = {
      id,
      name,
      createdAt: Date.now(),
      memtools,
      messages: [],
    };
    this.sessions.set(id, rec);
    return rec;
  }

  get(id: string) {
    return this.sessions.get(id) || null;
  }

  list() {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, name, createdAt, messages }) => ({ id, name, createdAt, messageCount: messages.length }));
  }

  remove(id: string): boolean {
    return this.sessions.delete(id);
  }
}

// Ensure a single shared store across all route modules/process hot reloads.
export function getSessionStore() {
  const g = globalThis as any;
  if (!g.__kianaSessionStore) {
    g.__kianaSessionStore = new SessionStore();
  }
  return g.__kianaSessionStore as SessionStore;
}
