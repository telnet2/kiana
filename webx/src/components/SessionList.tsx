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
  const [sessions, setSessions] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
  }, [activeId]); // Reload when activeId changes (including auto-created sessions)

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

  async function deleteSession(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete session: ${res.status}`);
      }
      await loadSessions();
      // If deleted session was active, deselect it
      if (activeId === id) {
        onSelect('');
      }
    } catch (e) {
      console.error('Error deleting session:', e);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }

  async function saveSessionName(id: string, name: string) {
    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to update session name: ${res.status}`);
      }
      await loadSessions();
    } catch (e) {
      console.error('Error saving session name:', e);
    } finally {
      setEditingId(null);
      setEditingName('');
    }
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  async function handleNameSubmit(id: string) {
    await saveSessionName(id, editingName);
  }

  function handleNameBlur(id: string) {
    handleNameSubmit(id);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === 'Enter') {
      handleNameSubmit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
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
          <div key={s.id} className="border-b border-bg-subtle">
            {deleteConfirm === s.id ? (
              <div className="p-3 bg-bg-muted">
                <div className="text-sm text-text-muted mb-2">Delete this session permanently?</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteSession(s.id)}
                    disabled={deleting}
                    className="flex-1 btn btn-danger text-xs"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="flex-1 btn text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onSelect(s.id)}
                className={`p-3 cursor-pointer hover:bg-bg-subtle transition-colors flex items-start justify-between group ${
                  activeId === s.id ? 'bg-bg-subtle' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleNameBlur(s.id)}
                      onKeyDown={(e) => handleNameKeyDown(e, s.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 rounded text-sm bg-bg-muted border border-bg-subtle focus:outline-none focus:border-text-muted"
                      placeholder="Enter session name"
                    />
                  ) : (
                    <>
                      <div className="text-sm font-semibold break-all">
                        {s.name || '(No name)'}
                      </div>
                      <div className="text-xs text-text-muted">
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-text-muted font-mono">{s.id}</div>
                    </>
                  )}
                </div>
                <div className="ml-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {editingId !== s.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(s.id, s.name);
                      }}
                      className="p-1 text-text-muted hover:text-text-default transition-colors"
                      title="Edit session name"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(s.id);
                    }}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    title="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
