'use client';
import { useEffect, useState } from 'react';
import SessionList from '@/components/SessionList';
import FileExplorer from '@/components/FileExplorer';
import FileEditor from '@/components/FileEditor';
import Terminal from '@/components/Terminal';
import { useHorizontalResize, useVerticalResize } from '@/components/Resizable';

export default function Page() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTreeRefresh, setFileTreeRefresh] = useState(0);

  const { ref: leftRef, width: leftWidth, Divider: VDivider1 } = useHorizontalResize(300);
  const { ref: topRef, height: topHeight, Divider: VDivider2 } = useVerticalResize(200);
  const { height: terminalHeight, Divider: HDivider } = useVerticalResize(220);

  // On first load: use most recent session if any; otherwise create one
  useEffect(() => {
    (async () => {
      const listRes = await fetch('/api/sessions', { cache: 'no-store' });
      const list = await listRes.json();
      const sessions = (list?.sessions ?? []) as { id: string }[];
      if (sessions.length > 0) {
        setActiveSession(sessions[0].id);
      } else {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        setActiveSession(data.session.id);
      }
    })();
  }, []);

  return (
    <div className="h-screen w-screen bg-bg-panel flex flex-col">
      {/* Main Content: Left Sidebar + Editor */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Pane: Sessions + File Explorer */}
        <div ref={leftRef} style={{ width: leftWidth }} className="h-full bg-bg-panel border-r border-bg-subtle flex flex-col">
          {/* Sessions */}
          <div style={{ height: topHeight }} className="overflow-hidden border-b border-bg-subtle">
            <SessionList
              activeId={activeSession}
              onSelect={(id) => setActiveSession(id)}
              onCreate={(s) => setActiveSession(s.id)}
            />
          </div>
          <VDivider2 />
          {/* File Explorer */}
          <div className="flex-1 min-h-0" key={fileTreeRefresh}>
            <FileExplorer
              sessionId={activeSession}
              onSelectFile={setSelectedFile}
              onFileCreated={() => setFileTreeRefresh((t) => t + 1)}
            />
          </div>
        </div>

        {/* Vertical Divider */}
        <VDivider1 />

        {/* Center Pane: File Editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          <FileEditor
            sessionId={activeSession}
            filePath={selectedFile}
          />
        </div>
      </div>

      {/* Horizontal Divider */}
      <HDivider />

      {/* Bottom Pane: Terminal */}
      <div style={{ height: terminalHeight }} className="min-h-0 border-t border-bg-subtle">
        <Terminal sessionId={activeSession} />
      </div>
    </div>
  );
}
