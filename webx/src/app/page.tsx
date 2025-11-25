'use client';
import { useEffect, useState } from 'react';
import SessionList from '@/components/SessionList';
import FileExplorer from '@/components/FileExplorer';
import Terminal from '@/components/Terminal';
import FileEditorModal from '@/components/FileEditorModal';
import { useHorizontalResize, useVerticalResize } from '@/components/Resizable';

export default function Page() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTreeRefresh, setFileTreeRefresh] = useState(0);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

  const { ref: leftRef, width: leftWidth, Divider: VDivider1 } = useHorizontalResize(300);
  // VDivider2: top splitter (Sessions/FileExplorer) - normal direction (drag down = grow)
  const { height: topHeight, Divider: VDivider2 } = useVerticalResize(200, false);

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
      {/* Main Content: Left Pane + Right Pane */}
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
              onSelectFile={(path) => {
                setSelectedFile(path);
                setIsEditorModalOpen(true);
              }}
              onFileCreated={() => setFileTreeRefresh((t) => t + 1)}
            />
          </div>
        </div>

        {/* Vertical Divider */}
        <VDivider1 />

        {/* Right Pane: Terminal/Chat */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Terminal
            sessionId={activeSession}
            onCommandExecuted={() => setFileTreeRefresh((t) => t + 1)}
          />
        </div>
      </div>

      {/* File Editor Modal */}
      <FileEditorModal
        sessionId={activeSession}
        filePath={selectedFile}
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
      />
    </div>
  );
}
