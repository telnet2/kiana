'use client';
import { useEffect, useState } from 'react';

type Node = {
  type: 'file' | 'directory';
  name: string;
  isDirty?: boolean;
  children?: Node[];
};

function TreeNode({
  node,
  path,
  depth = 0,
  onSelectFile,
}: {
  node: Node;
  path: string;
  depth?: number;
  onSelectFile: (path: string) => void;
}) {
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
          <span className="text-text-muted text-sm">{expanded ? '▾' : '▸'}</span>
          <span className="font-medium text-sm">{node.name || '/'}</span>
        </div>
        {expanded && (
          <div>
            {(node.children || []).map((child) => (
              <TreeNode
                key={`${path}/${child.name}`}
                node={child}
                path={`${path}/${child.name}`}
                depth={depth + 1}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`px-2 py-1 hover:bg-bg-subtle rounded cursor-pointer text-sm flex items-center gap-1 ${
        node.isDirty ? 'font-bold' : ''
      }`}
      style={indent}
      title={path}
      onClick={() => onSelectFile(path)}
    >
      {node.isDirty && <span className="text-orange-400">●</span>}
      <span>{node.name}</span>
    </div>
  );
}

export default function FileExplorer({
  sessionId,
  onSelectFile,
  onFileCreated,
}: {
  sessionId?: string | null;
  onSelectFile: (path: string) => void;
  onFileCreated?: () => void;
}) {
  const [tree, setTree] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'directory'>('file');
  const [dirtyCount, setDirtyCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);

  function countDirtyFiles(node: Node | null): number {
    if (!node) return 0;
    let count = node.isDirty ? 1 : 0;
    if (node.children) {
      for (const child of node.children) {
        count += countDirtyFiles(child);
      }
    }
    return count;
  }

  async function refresh() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fs/tree?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setTree(data.root);
        setDirtyCount(countDirtyFiles(data.root));
      }
    } catch (e) {
      console.error('Error loading tree:', e);
    }
    setLoading(false);
  }

  async function onFlush() {
    if (!sessionId) return;
    setIsFlushing(true);
    try {
      const res = await fetch(`/api/flush?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Flush result:', data);
        await refresh();
      } else {
        console.error('Flush failed:', await res.text());
      }
    } catch (e) {
      console.error('Error flushing:', e);
    }
    setIsFlushing(false);
  }

  useEffect(() => {
    refresh();
  }, [sessionId]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!sessionId) return;
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    const form = new FormData();
    for (const f of Array.from(files)) {
      form.append('file', f);
    }
    await fetch(`/api/fs/import?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: form,
    });
    await refresh();
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

  async function createNewFile() {
    if (!sessionId || !newFileName.trim()) return;
    try {
      const path = `/${newFileName.trim()}`;
      await fetch(`/api/fs/create?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, type: newFileType }),
      });
      setShowNewFileDialog(false);
      setNewFileName('');
      setNewFileType('file');
      await refresh();
      onFileCreated?.();
      onSelectFile(path);
    } catch (e) {
      console.error('Error creating file:', e);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-bg-subtle flex-wrap">
        <button className="btn-ghost text-xs" onClick={() => setShowNewFileDialog(true)} disabled={!sessionId}>
          New File
        </button>
        <label className="btn-ghost cursor-pointer text-xs">
          <input type="file" multiple className="hidden" onChange={onImport} />
          Import Files
        </label>
        <label className="btn-ghost cursor-pointer text-xs">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={onImport}
            {...{ webkitdirectory: "true", directory: "true" } as any}
          />
          Import Folder
        </label>
        <button className="btn-ghost text-xs" onClick={onExport} disabled={!sessionId}>
          Export ZIP
        </button>
        <button className="btn-ghost text-xs" onClick={refresh} disabled={!sessionId}>
          Refresh
        </button>
        {dirtyCount > 0 && (
          <button
            className="btn text-xs bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
            onClick={onFlush}
            disabled={!sessionId || isFlushing}
            title={`Flush ${dirtyCount} dirty file${dirtyCount !== 1 ? 's' : ''} to VFS`}
          >
            {isFlushing ? 'Flushing…' : `Flush (${dirtyCount})`}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-2">
        {!sessionId && <div className="text-text-muted text-sm">Create or select a session</div>}
        {loading && <div className="text-text-muted text-sm">Loading…</div>}
        {tree && <TreeNode node={tree} path="/" onSelectFile={onSelectFile} />}
      </div>

      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-96 bg-bg-panel border border-bg-subtle rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-bg-subtle">
              <div className="text-sm font-medium">Create New {newFileType === 'file' ? 'File' : 'Directory'}</div>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowNewFileDialog(false)}
              >
                Close
              </button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs text-text-muted">Type</label>
                <div className="flex gap-2 mt-1">
                  <button
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      newFileType === 'file'
                        ? 'bg-accent text-white'
                        : 'bg-bg-subtle text-text hover:bg-bg-subtle/80'
                    }`}
                    onClick={() => setNewFileType('file')}
                  >
                    File
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      newFileType === 'directory'
                        ? 'bg-accent text-white'
                        : 'bg-bg-subtle text-text hover:bg-bg-subtle/80'
                    }`}
                    onClick={() => setNewFileType('directory')}
                  >
                    Directory
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted">Name</label>
                <input
                  className="input mt-1"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={newFileType === 'file' ? 'filename.txt' : 'dirname'}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-3 border-t border-bg-subtle">
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowNewFileDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn text-xs"
                onClick={createNewFile}
                disabled={!newFileName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
