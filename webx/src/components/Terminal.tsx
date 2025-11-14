'use client';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { isTextUIPart, isToolOrDynamicToolUIPart, getToolOrDynamicToolName, type UIMessage } from 'ai';
import ToolResultView from './ToolResultView';

interface ShellMessage {
  id: string;
  role: 'user' | 'assistant';
  command?: string;
  output?: string;
  exitCode?: number;
  error?: string;
}

export default function Terminal({
  sessionId,
}: {
  sessionId?: string | null;
}) {
  const [mode, setMode] = useState<'shell' | 'agent'>('shell');
  const [input, setInput] = useState('');
  const [shellMessages, setShellMessages] = useState<ShellMessage[]>([]);
  const [shellExecuting, setShellExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
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
  }, [messages.length, shellMessages.length, streaming, shellExecuting]);

  useEffect(() => {
    if (!streaming && !shellExecuting && sessionId) inputRef.current?.focus();
  }, [streaming, shellExecuting, sessionId]);

  async function executeShellCommand(command: string) {
    if (!sessionId) return;
    setShellExecuting(true);

    // Add to history
    setCommandHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    // Add user message
    const userMsg: ShellMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      command,
    };
    setShellMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/shell?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();

      const assistantMsg: ShellMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        output: data.output,
        exitCode: data.exitCode,
        error: data.error,
      };
      setShellMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: ShellMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        error: (e as Error).message,
        exitCode: 1,
      };
      setShellMessages((prev) => [...prev, errorMsg]);
    }

    setShellExecuting(false);
  }

  async function send() {
    if (!sessionId || !input.trim() || streaming || shellExecuting) return;
    const prompt = input.trim();

    // Check for mode switching commands
    if (prompt === '/exit') {
      if (mode === 'agent') {
        setMode('shell');
        setInput('');
      }
      setInput('');
      return;
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
      await executeShellCommand(prompt);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === 'ArrowUp' && mode === 'shell') {
      e.preventDefault();
      const newIndex = historyIndex + 1;
      if (newIndex < commandHistory.length) {
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown' && mode === 'shell') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg-panel">
      <div className="flex items-center justify-between p-2 border-b border-bg-subtle bg-bg-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Mode:</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            mode === 'agent'
              ? 'bg-accent text-white'
              : 'bg-bg-panel text-accent'
          }`}>
            {mode.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-text-muted">
          {mode === 'agent' && '← Type /exit to shell'}
          {mode === 'shell' && '← Type /kiana to agent'}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2 scroll-thin">
        {mode === 'shell' ? (
          // Shell mode messages
          shellMessages.map((m) => (
            <div key={m.id} className="text-xs whitespace-pre-wrap leading-relaxed font-mono">
              {m.command && (
                <div className="text-text-default">
                  <span className="text-accent">$ </span>
                  {m.command}
                </div>
              )}
              {m.output && (
                <div className="text-text-muted">{m.output}</div>
              )}
              {m.error && (
                <div className="text-red-400">{m.error}</div>
              )}
            </div>
          ))
        ) : (
          // Agent mode messages
          messages.map((m, i) => (
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
          ))
        )}
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
