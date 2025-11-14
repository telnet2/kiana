'use client';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { isTextUIPart, isToolOrDynamicToolUIPart, getToolOrDynamicToolName, type UIMessage } from 'ai';
import ToolResultView from './ToolResultView';

export default function Terminal({
  sessionId,
}: {
  sessionId?: string | null;
}) {
  const [mode, setMode] = useState<'shell' | 'agent'>('shell');
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: sessionId ?? undefined,
    api: '/api/chat',
    body: sessionId ? { sessionId } : undefined,
  });

  const streaming = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streaming]);

  useEffect(() => {
    if (!streaming && sessionId) inputRef.current?.focus();
  }, [streaming, sessionId]);

  async function send() {
    if (!sessionId || !input.trim() || streaming) return;
    const prompt = input.trim();

    // Check for mode switching commands
    if (prompt === '/exit') {
      if (mode === 'agent') {
        setMode('shell');
        setInput('');
        return;
      } else {
        setInput('');
        return;
      }
    }

    if (prompt.startsWith('/kiana')) {
      setMode('agent');
      const msg = prompt.slice(6).trim();
      setInput('');
      await sendMessage({ text: msg || 'Ready to help' });
      return;
    }

    setInput('');

    if (mode === 'agent') {
      await sendMessage({ text: prompt });
    } else {
      // Shell mode - send to agent with shell execution
      // For now, we'll use the same chat endpoint
      await sendMessage({ text: prompt });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg-panel">
      <div className="flex items-center justify-between p-2 border-b border-bg-subtle">
        <div className="text-xs text-text-muted">
          Mode:{' '}
          <span className={mode === 'agent' ? 'text-accent' : 'text-text'}>
            {mode.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-text-muted">
          {mode === 'agent' && 'Type /exit to switch to shell'}
          {mode === 'shell' && 'Type /kiana to switch to agent'}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2 scroll-thin">
        {messages.map((m, i) => (
          <div key={m.id ?? i} className="rounded-md p-2 bg-bg-subtle text-sm">
            <div className="text-xs text-text-muted mb-1">{m.role.toUpperCase()}</div>
            <div className="space-y-1">
              {m.parts.map((part, idx) => {
                if (isTextUIPart(part)) {
                  return (
                    <div key={idx} className="whitespace-pre-wrap text-xs leading-relaxed">
                      {part.text}
                    </div>
                  );
                }
                if (isToolOrDynamicToolUIPart(part)) {
                  const toolName = getToolOrDynamicToolName(part);
                  if (part.state === 'input-streaming' || part.state === 'input-available') {
                    return (
                      <div key={idx} className="text-xs text-text-muted">
                        {toolName}: running…
                      </div>
                    );
                  }
                  if (part.state === 'output-available' || part.state === 'output-error') {
                    return (
                      <ToolResultView
                        key={idx}
                        toolName={toolName}
                        toolPart={part as any}
                      />
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
      <div className="p-2 border-t border-bg-subtle">
        <div className="flex items-center gap-2">
          <input
            className="input text-xs"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={sessionId ? 'Type command and press Enter…' : 'Create/select a session first'}
            disabled={!sessionId || streaming}
            ref={inputRef}
            autoFocus
          />
          <button className="btn text-xs px-2" onClick={send} disabled={!sessionId || streaming}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
