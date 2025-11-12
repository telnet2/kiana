"use client";
import { useEffect, useState } from 'react';
import SessionList from '@/components/SessionList';
import FileTree from '@/components/FileTree';
import Chat from '@/components/Chat';
import { useHorizontalResize, useVerticalResize } from '@/components/Resizable';

export default function Page() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const { ref, width, Divider: VDivider } = useHorizontalResize(500);
  const { height, Divider: HDivider } = useVerticalResize(220);

  // On first load: use most recent session if any; otherwise create one
  useEffect(() => {
    (async () => {
      const listRes = await fetch('/api/sessions', { cache: 'no-store' });
      const list = await listRes.json();
      const sessions = (list?.sessions ?? []) as { id: string }[];
      if (sessions.length > 0) {
        setActiveSession(sessions[0].id);
      } else {
        const res = await fetch('/api/sessions', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        setActiveSession(data.session.id);
      }
    })();
  }, []);

  return (
    <div className="h-screen w-screen">
      <div className="h-full flex">
        {/* Left Pane */}
        <div ref={ref} style={{ width }} className="h-full bg-bg-panel border-r border-bg-subtle flex flex-col">
          <div style={{ height }} className="overflow-hidden">
            <SessionList
              activeId={activeSession}
              onSelect={(id) => setActiveSession(id)}
              onCreate={(s) => setActiveSession(s.id)}
            />
          </div>
          <HDivider />
          <div className="flex-1 min-h-0">
            <FileTree sessionId={activeSession} />
          </div>
        </div>

        {/* Divider */}
        <VDivider />

        {/* Right Pane - Chat */}
        <div className="flex-1 min-w-0">
          <Chat sessionId={activeSession} />
        </div>
      </div>
    </div>
  );
}
