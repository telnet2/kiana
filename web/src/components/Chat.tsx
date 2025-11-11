"use client";
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { isTextUIPart, isToolOrDynamicToolUIPart, getToolOrDynamicToolName, type UIMessage } from 'ai';
import MemfsInvocationView from '@/components/MemfsInvocationView';

export default function Chat({ sessionId }: { sessionId?: string | null }) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: sessionId ?? undefined,
    api: '/api/chat',
    body: sessionId ? { sessionId } : undefined,
  });

  const streaming = status === 'streaming' || status === 'submitted';

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, streaming]);
  useEffect(() => { if (!streaming && sessionId) inputRef.current?.focus(); }, [streaming, sessionId]);

  async function send() {
    if (!sessionId || !input.trim() || streaming) return;
    const prompt = input.trim();
    setInput('');
    await sendMessage({ text: prompt });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={m.id ?? i} className="rounded-md p-3 bg-bg-subtle">
            <div className="text-xs text-text-muted mb-1">{m.role.toUpperCase()}</div>
            <div className="space-y-2">
              {m.parts.map((part, idx) => {
                if (isTextUIPart(part)) {
                  return (
                    <div key={idx} className="whitespace-pre-wrap text-sm leading-relaxed">
                      {part.text}
                    </div>
                  );
                }
                if (isToolOrDynamicToolUIPart(part)) {
                  const toolName = getToolOrDynamicToolName(part);
                  if (toolName === 'memfs_exec') {
                    return <MemfsInvocationView key={(part as any).toolCallId || idx} invocation={part as any} />;
                  }
                  // Fallback generic rendering for other tools
                  switch (part.state) {
                    case 'input-streaming':
                    case 'input-available':
                      return (
                        <div key={idx} className="text-xs text-text-muted">
                          {toolName}: running…
                        </div>
                      );
                    case 'output-available':
                      return (
                        <pre key={idx} className="text-[12px] bg-black/20 p-2 rounded whitespace-pre-wrap break-words">
                          {typeof (part as any).output === 'string' ? (part as any).output : JSON.stringify((part as any).output, null, 2)}
                        </pre>
                      );
                    case 'output-error':
                      return (
                        <div key={idx} className="text-xs text-red-400">
                          {toolName} error: {(part as any).errorText}
                        </div>
                      );
                  }
                }
                return null;
              })}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-bg-subtle">
        <div className="flex items-center gap-2">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={sessionId ? 'Type a message and press Enter…' : 'Create/select a session first'}
            disabled={!sessionId || streaming}
            ref={inputRef}
            autoFocus
          />
          <button className="btn" onClick={send} disabled={!sessionId || streaming}>Send</button>
        </div>
      </div>
    </div>
  );
}
