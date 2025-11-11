"use client";
import { useEffect, useRef, useState } from 'react';

export function useHorizontalResize(defaultWidthPx: number) {
  const [width, setWidth] = useState<number>(defaultWidthPx);
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !ref.current) return;
      const x = e.clientX;
      setWidth(Math.max(240, Math.min(window.innerWidth - 300, x)));
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const Divider = () => (
    <div
      className="divider-h"
      onMouseDown={() => (dragging.current = true)}
      style={{ width: 6, cursor: 'col-resize' }}
    />
  );

  return { ref, width, Divider } as const;
}

export function useVerticalResize(defaultHeightPx: number) {
  const [height, setHeight] = useState<number>(defaultHeightPx);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const y = e.clientY;
      setHeight(Math.max(120, Math.min(window.innerHeight - 200, y)));
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const Divider = () => (
    <div
      className="divider-v"
      onMouseDown={() => (dragging.current = true)}
      style={{ height: 6, cursor: 'row-resize' }}
    />
  );

  return { height, Divider } as const;
}

