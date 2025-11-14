'use client';
import { useEffect, useRef } from 'react';
import FileEditor from './FileEditor';

export default function FileEditorModal({
  sessionId,
  filePath,
  isOpen,
  onClose,
}: {
  sessionId?: string | null;
  filePath?: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="w-11/12 h-5/6 bg-bg-panel border border-bg-subtle rounded-lg shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3 border-b border-bg-subtle bg-bg-subtle">
          <div className="text-sm font-medium text-text-default truncate">
            {filePath || 'File Editor'}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost text-xs px-2"
            aria-label="Close editor"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0">
          <FileEditor sessionId={sessionId} filePath={filePath} />
        </div>
      </div>
    </div>
  );
}
