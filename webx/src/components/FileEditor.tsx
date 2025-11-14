'use client';
import { useEffect, useState } from 'react';

export default function FileEditor({
  sessionId,
  filePath,
  onFileRefresh,
}: {
  sessionId?: string | null;
  filePath?: string | null;
  onFileRefresh?: () => void;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!sessionId || !filePath) {
      setContent('');
      setIsDirty(false);
      return;
    }

    setLoading(true);
    setIsDirty(false);
    fetch(`/api/fs/file?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => setContent(data.content ?? ''))
      .catch((e) => {
        console.error('Error loading file:', e);
        setContent('');
      })
      .finally(() => setLoading(false));
  }, [sessionId, filePath]);

  async function saveFile() {
    if (!sessionId || !filePath) return;
    setSaving(true);
    try {
      await fetch(`/api/fs/file?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      setIsDirty(false);
      onFileRefresh?.();
    } catch (e) {
      console.error('Error saving file:', e);
    }
    setSaving(false);
  }

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-bg-subtle">
        <div className="text-sm font-mono truncate">{filePath}</div>
        <button
          className="btn text-xs"
          onClick={saveFile}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="p-4 text-text-muted">Loading…</div>
        ) : (
          <textarea
            className="w-full h-full p-4 bg-bg-panel text-text font-mono text-sm outline-none resize-none border-none"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            spellCheck="false"
          />
        )}
      </div>
    </div>
  );
}
