'use client';
import { useEffect, useState } from 'react';

type Node = {
  type: 'file' | 'directory';
  name: string;
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
      className="px-2 py-1 hover:bg-bg-subtle rounded cursor-pointer text-sm"
      style={indent}
      title={path}
      onClick={() => onSelectFile(path)}
    >
      {node.name}
    </div>
  );
}

export default function FileExplorer({
  sessionId,
  onSelectFile,
}: {
  sessionId?: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [tree, setTree] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);

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
      }
    } catch (e) {
      console.error('Error loading tree:', e);
    }
    setLoading(false);
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-bg-subtle flex-wrap">
        <label className="btn-ghost cursor-pointer text-xs">
          <input type="file" multiple className="hidden" onChange={onImport} />
          Import Files
        </label>
        <label className="btn-ghost cursor-pointer text-xs">
          <input type="file" multiple className="hidden" onChange={onImport} webkitdirectory="true" directory="true" />
          Import Folder
        </label>
        <button className="btn-ghost text-xs" onClick={onExport} disabled={!sessionId}>
          Export ZIP
        </button>
        <button className="btn-ghost text-xs" onClick={refresh} disabled={!sessionId}>
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-2">
        {!sessionId && <div className="text-text-muted text-sm">Create or select a session</div>}
        {loading && <div className="text-text-muted text-sm">Loading…</div>}
        {tree && <TreeNode node={tree} path="/" onSelectFile={onSelectFile} />}
      </div>
    </div>
  );
}
