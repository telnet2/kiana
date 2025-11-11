"use client";
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

type SessionInfo = { id: string; name?: string; createdAt: number; messageCount: number };

export default function SessionList({
  activeId,
  onSelect,
  onCreate,
  onRemove,
}: {
  activeId?: string | null;
  onSelect: (id: string) => void;
  onCreate: (session: SessionInfo) => void;
  onRemove?: (id: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const res = await fetch('/api/sessions', { cache: 'no-store' });
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  }

  async function create() {
    const res = await fetch('/api/sessions', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    const session = { id: data.session.id, name: data.session.name, createdAt: data.session.createdAt, messageCount: 0 } as SessionInfo;
    setSessions((prev) => [session, ...prev]);
    onCreate(session);
  }

  async function remove(id: string) {
    const s = sessions.find((x) => x.id === id);
    const name = s?.name || id;
    const confirmed = typeof window !== 'undefined' ? window.confirm(`Remove session ${name}?`) : true;
    if (!confirmed) return;
    await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

    // Compute selection before state update
    let nextId: string | null = null;
    if (activeId === id) {
      const idx = sessions.findIndex((x) => x.id === id);
      const rest = sessions.filter((x) => x.id !== id);
      if (rest.length > 0) {
        const pick = rest[Math.min(idx, rest.length - 1)];
        nextId = pick.id;
      }
    }

    setSessions((prev) => prev.filter((s) => s.id !== id));

    if (activeId === id) {
      if (nextId) onSelect(nextId);
      else if (onRemove) onRemove(id);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Sessions</h2>
        <button className="btn-ghost" onClick={create}>New</button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {loading && <div className="text-text-muted text-sm">Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="text-text-muted text-sm">No sessions yet</div>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <div
                className={clsx(
                  'group w-full px-3 py-2 rounded-md hover:bg-bg-subtle transition border border-transparent',
                  activeId === s.id && 'bg-bg-subtle border-accent/30'
                )}
                title={new Date(s.createdAt).toLocaleString()}
              >
                <div className="flex items-center justify-between">
                  <button className="text-left flex-1" onClick={() => onSelect(s.id)}>
                    <div className="text-sm font-medium truncate">{s.name || s.id}</div>
                    <div className="text-xs text-text-muted">{new Date(s.createdAt).toLocaleTimeString()}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{s.messageCount}</span>
                    <button
                      className="btn-ghost text-xs opacity-70 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                      title="Remove session"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
