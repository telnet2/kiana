'use client';
import { useState } from 'react';

function truncateOutput(output: any, maxItems: number = 5): { preview: string; isTruncated: boolean; count: number } {
  if (typeof output === 'string') {
    const lines = output.split('\n');
    const preview = lines.slice(0, maxItems).join('\n');
    const isTruncated = lines.length > maxItems;
    return { preview, isTruncated, count: lines.length };
  }

  if (Array.isArray(output)) {
    const preview = output.slice(0, maxItems);
    const isTruncated = output.length > maxItems;
    const previewStr = preview.map((item) => {
      if (typeof item === 'string') return `  - ${item}`;
      if (typeof item === 'object') return `  - ${JSON.stringify(item)}`;
      return `  - ${item}`;
    }).join('\n');
    return {
      preview: previewStr,
      isTruncated,
      count: output.length,
    };
  }

  if (typeof output === 'object' && output !== null) {
    const str = JSON.stringify(output, null, 2);
    const lines = str.split('\n');
    const preview = lines.slice(0, maxItems).join('\n');
    const isTruncated = lines.length > maxItems;
    return { preview, isTruncated, count: lines.length };
  }

  return { preview: String(output), isTruncated: false, count: 1 };
}

export default function ToolResultView({
  toolName,
  toolPart,
}: {
  toolName: string;
  toolPart: {
    state: 'output-available' | 'output-error';
    output?: any;
    errorText?: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const output = toolPart.state === 'output-error' ? toolPart.errorText : toolPart.output;
  const isError = toolPart.state === 'output-error';

  if (!output) {
    return (
      <div className={`text-xs ${isError ? 'text-red-400' : 'text-text-muted'}`}>
        ⏺ {toolName}: (no output)
      </div>
    );
  }

  const { preview, isTruncated, count } = truncateOutput(output, 5);
  const displayStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

  if (!isTruncated && preview.length < 200 && !isError) {
    // Short output, show inline
    return (
      <div className={`text-xs p-2 rounded bg-black/20 text-text-muted whitespace-pre-wrap break-words`}>
        <span className="font-medium">⏺ {toolName}</span>
        <div className="mt-1">{displayStr}</div>
      </div>
    );
  }

  return (
    <div className="text-xs border border-bg-subtle rounded overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 bg-bg-subtle hover:bg-bg-subtle/80 font-medium flex items-center justify-between transition-colors"
      >
        <span>
          ⏺ {toolName}
          {isTruncated && <span className="text-text-muted ml-2">… (+{count - 5})</span>}
        </span>
        <span className="text-text-muted text-xs">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className={`p-3 bg-black/20 border-t border-bg-subtle max-h-96 overflow-auto scroll-thin ${
          isError ? 'text-red-400' : 'text-text-muted'
        }`}>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
            {displayStr}
          </pre>
        </div>
      )}
      {!expanded && isTruncated && (
        <div className={`px-3 py-2 bg-black/20 border-t border-bg-subtle text-xs ${
          isError ? 'text-red-400' : 'text-text-muted'
        } whitespace-pre-wrap font-mono`}>
          {preview}
        </div>
      )}
    </div>
  );
}
