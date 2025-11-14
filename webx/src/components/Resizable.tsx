'use client';
import { useRef, useState } from 'react';

export function useHorizontalResize(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const ref = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);
  const startWidthRef = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (startXRef.current === null || startWidthRef.current === null) return;
    e.preventDefault();
    const delta = e.clientX - startXRef.current;
    const newWidth = Math.max(100, startWidthRef.current + delta);
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    startXRef.current = null;
    startWidthRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const Divider = () => (
    <div
      className="w-1 bg-bg-subtle hover:bg-accent/50 cursor-col-resize transition-colors"
      onMouseDown={handleMouseDown}
    />
  );

  return { ref, width, Divider };
}

export function useVerticalResize(initialHeight: number) {
  const [height, setHeight] = useState(initialHeight);
  const ref = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const startHeightRef = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (startYRef.current === null || startHeightRef.current === null) return;
    e.preventDefault();
    const delta = e.clientY - startYRef.current;
    const newHeight = Math.max(100, startHeightRef.current + delta);
    setHeight(newHeight);
  };

  const handleMouseUp = () => {
    startYRef.current = null;
    startHeightRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const Divider = () => (
    <div
      className="h-1 bg-bg-subtle hover:bg-accent/50 cursor-row-resize transition-colors"
      onMouseDown={handleMouseDown}
    />
  );

  return { ref, height, Divider };
}
