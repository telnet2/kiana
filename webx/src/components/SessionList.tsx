'use client';
import { useEffect, useState } from 'react';

export default function SessionList({
  activeId,
  onSelect,
  onCreate,
}: {
  activeId?: string | null;
  onSelect: (id: string) => void;
  onCreate: (session: { id: string }) => void;
}) {
  const [sessions, setSessions] = useState<{ id: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function loadSessions() {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error('Error loading sessions:', e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function createSession() {
    setCreating(true);
    try {
      const res = await fetch('/api/sessions', { method: 'POST', cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to create session: ${res.status}`);
      }
      const data = await res.json();
      if (!data.session || !data.session.id) {
        throw new Error('Invalid response from server');
      }
      await loadSessions();
      onCreate(data.session);
    } catch (e) {
      console.error('Error creating session:', e);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-bg-subtle">
        <button className="btn w-full" onClick={createSession} disabled={creating || loading}>
          {creating ? 'Creating…' : 'New Session'}
        </button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {loading && <div className="p-2 text-sm text-text-muted">Loading…</div>}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`p-3 border-b border-bg-subtle cursor-pointer hover:bg-bg-subtle transition-colors ${
              activeId === s.id ? 'bg-bg-subtle' : ''
            }`}
          >
            <div className="text-xs text-text-muted">
              {new Date(s.createdAt).toLocaleString()}
            </div>
            <div className="text-sm font-mono break-all">{s.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
