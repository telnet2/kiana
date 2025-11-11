"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UIToolInvocation } from 'ai';

type MemfsToolIO = {
  input: { command?: string };
  output: { result?: string; success?: boolean } | string | undefined;
};

function toText(output: MemfsToolIO['output']): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof (output as any).result === 'string') return (output as any).result as string;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function truncate(text: string, maxChars = 800, maxLines = 30) {
  if (!text) return { preview: '', truncated: false };
  const lines = text.split(/\r?\n/);
  const sliced = lines.slice(0, maxLines).join('\n');
  if (sliced.length > maxChars) {
    return { preview: sliced.slice(0, maxChars), truncated: true };
  }
  const truncated = lines.length > maxLines || text.length > maxChars;
  return { preview: truncated ? sliced : text, truncated };
}

export default function MemfsInvocationView({
  invocation,
}: {
  invocation: UIToolInvocation<MemfsToolIO>;
}) {
  const [expanded, setExpanded] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const finishedAtRef = useRef<number | null>(null);

  // Reset start time when a new tool call id is seen
  useEffect(() => {
    startedAtRef.current = Date.now();
    finishedAtRef.current = null;
  }, [invocation.toolCallId]);

  // Set finish time once when output is available or errored
  useEffect(() => {
    if ((invocation.state === 'output-available' || invocation.state === 'output-error') && !finishedAtRef.current) {
      finishedAtRef.current = Date.now();
    }
  }, [invocation.state]);

  const command = useMemo(() => invocation.input && (invocation.input as any).command, [invocation.input]);
  const fullText = useMemo(() => toText((invocation as any).output), [invocation]);
  const { preview, truncated } = useMemo(() => truncate(fullText), [fullText]);

  const Running = invocation.state === 'input-streaming' || invocation.state === 'input-available';
  const Ok = invocation.state === 'output-available' && (typeof (invocation as any).output === 'object' ? (invocation as any).output?.success !== false : true);
  const Errored = invocation.state === 'output-error';

  const startLocal = useMemo(() => new Date(startedAtRef.current).toLocaleTimeString(), [invocation.toolCallId]);
  const durationMs = (finishedAtRef.current ?? Date.now()) - startedAtRef.current;
  const durationText = useMemo(() => formatDuration(durationMs), [durationMs]);

  return (
    <div className="rounded-md border border-bg-subtle bg-black/20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-accent/30 text-white">memfs_exec</span>
          {command && <code className="text-xs text-text-muted">{command}</code>}
        </div>
        <div className="flex items-center gap-3">
          {Running && <span className="text-xs text-text-muted">Running…</span>}
          {Ok && <span className="text-xs text-green-400">Success</span>}
          {Errored && <span className="text-xs text-red-400">Error</span>}
          <span className="text-xs text-text-muted">{startLocal}</span>
          <span className="text-xs text-text-muted">{durationText}</span>
          {(invocation.state === 'output-available' || Errored) && (
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(fullText || '');
                }}
                title="Copy output"
              >
                Copy
              </button>
              {truncated && (
                <button className="btn-ghost text-xs" onClick={() => setExpanded((e) => !e)}>
                  {expanded ? 'Collapse' : 'Expand'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {(invocation.state === 'output-available' || Errored) && (
        <div className="p-3">
          <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed">
            {expanded || !truncated ? fullText : preview + '\n…'}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}
