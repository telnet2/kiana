"use client";
import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';

type Node = {
  type: 'file' | 'directory';
  name: string;
  children?: Node[];
};

function TreeNode({ node, path, depth = 0 }: { node: Node; path: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth <= 1);
  const indent = { paddingLeft: `${depth * 12}px` } as const;

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-subtle cursor-pointer"
          style={indent}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="text-text-muted">{expanded ? '▾' : '▸'}</span>
          <span className="font-medium">{node.name || '/'}</span>
        </div>
        {expanded && (
          <div>
            {(node.children || []).map((child) => (
              <TreeNode key={`${path}/${child.name}`} node={child} path={`${path}/${child.name}`} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="px-2 py-1 hover:bg-bg-subtle rounded" style={indent} title={path}>
      <span className="text-sm">{node.name}</span>
    </div>
  );
}

export default function FileTree({ sessionId, onRefreshed }: { sessionId?: string | null; onRefreshed?: () => void }) {
  const [tree, setTree] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPath, setEditorPath] = useState<string>('/_system_prompt');
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorSaving, setEditorSaving] = useState(false);

  async function refresh() {
    if (!sessionId) return;
    setLoading(true);
    const res = await fetch(`/api/fs/tree?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setTree(data.root);
    setLoading(false);
    onRefreshed?.();
  }

  useEffect(() => { refresh(); }, [sessionId]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!sessionId) return;
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    const form = new FormData();
    for (const f of Array.from(files)) {
      form.append('file', f);
    }
    await fetch(`/api/fs/import?sessionId=${encodeURIComponent(sessionId)}`, { method: 'POST', body: form });
    await refresh();
    // Reset the input so the same selection can be re-imported later
    input.value = '';
  }

  async function onExport() {
    if (!sessionId) return;
    const res = await fetch(`/api/fs/export?sessionId=${encodeURIComponent(sessionId)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memfs-${sessionId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openEditor(path: string) {
    if (!sessionId) return;
    setEditorPath(path);
    try {
      const res = await fetch(`/api/fs/file?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setEditorContent(data.content ?? '');
      } else {
        setEditorContent('');
      }
    } catch {
      setEditorContent('');
    }
    setEditorOpen(true);
  }

  async function saveEditor() {
    if (!sessionId) return;
    setEditorSaving(true);
    await fetch(`/api/fs/file?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: editorPath, content: editorContent }),
    });
    setEditorSaving(false);
    setEditorOpen(false);
    await refresh();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-bg-subtle">
        <label className="btn-ghost cursor-pointer">
          <input type="file" multiple className="hidden" onChange={onImport} />
          Import Files
        </label>
        <label className="btn-ghost cursor-pointer">
          <input type="file" multiple className="hidden" onChange={onImport} webkitdirectory="true" directory="true" />
          Import Folder
        </label>
        <button className="btn-ghost" onClick={onExport} disabled={!sessionId}>Export Zip</button>
        <button className="btn-ghost" onClick={refresh} disabled={!sessionId}>Refresh</button>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={() => openEditor('/_system_prompt')} disabled={!sessionId}>Edit Prompt</button>
        <button className="btn-ghost" onClick={() => openEditor('/new_file.txt')} disabled={!sessionId}>New File</button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-2">
        {!sessionId && <div className="text-text-muted text-sm">Create or select a session</div>}
        {loading && <div className="text-text-muted text-sm">Loading…</div>}
        {tree && <TreeNode node={tree} path="/" />}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[90vw] max-w-3xl bg-bg-panel border border-bg-subtle rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-bg-subtle">
              <div className="text-sm font-medium">Edit File</div>
              <button className="btn-ghost text-xs" onClick={() => setEditorOpen(false)}>Close</button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs text-text-muted">Path</label>
                <input
                  className="input mt-1"
                  value={editorPath}
                  onChange={(e) => setEditorPath(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Content</label>
                <textarea
                  className="w-full h-64 rounded-md bg-bg-subtle text-text px-3 py-2 border border-transparent focus:border-accent/70 outline-none"
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-3 border-t border-bg-subtle">
              <button className="btn-ghost" onClick={() => setEditorOpen(false)} disabled={editorSaving}>Cancel</button>
              <button className="btn" onClick={saveEditor} disabled={editorSaving}>{editorSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
