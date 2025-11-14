'use client';
import { useState } from 'react';

function truncateOutput(output: any, maxLines: number = 5): { preview: string; isTruncated: boolean; count: number } {
  if (typeof output === 'string') {
    const lines = output.split('\n');
    const preview = lines.slice(0, maxLines).join('\n');
    const isTruncated = lines.length > maxLines;
    return { preview, isTruncated, count: lines.length };
  }

  if (Array.isArray(output)) {
    const preview = output.slice(0, maxLines);
    const isTruncated = output.length > maxLines;
    return {
      preview: preview.map((item) => `  - ${JSON.stringify(item)}`).join('\n'),
      isTruncated,
      count: output.length,
    };
  }

  if (typeof output === 'object' && output !== null) {
    const str = JSON.stringify(output, null, 2);
    const lines = str.split('\n');
    const preview = lines.slice(0, maxLines).join('\n');
    const isTruncated = lines.length > maxLines;
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
        {toolName}: (no output)
      </div>
    );
  }

  const { preview, isTruncated, count } = truncateOutput(output, 5);
  const displayStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

  if (!isTruncated && preview.length < 200) {
    // Short output, show inline
    return (
      <div className={`text-xs p-2 rounded bg-black/20 ${isError ? 'text-red-400' : 'text-text-muted'} whitespace-pre-wrap break-words`}>
        <span className="font-medium">{toolName}:</span>
        {'\n'}
        {displayStr}
      </div>
    );
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer p-2 rounded hover:bg-bg-subtle font-medium">
        ⏺ {toolName}
        {isTruncated && ` (+${count - 5} more)`}
      </summary>
      <div className="ml-4 mt-1 p-2 bg-black/20 rounded max-h-64 overflow-auto scroll-thin">
        <pre className={`whitespace-pre-wrap break-words ${isError ? 'text-red-400' : 'text-text-muted'} text-xs`}>
          {displayStr}
        </pre>
      </div>
    </details>
  );
}
