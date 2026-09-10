"use client";

/**
 * Letterhead zoom overlay: fit / zoom controls, draggable guides that paint CSS vars on the
 * root (no React render per mouse move), Space + drag to pan, Esc to close. Guides are
 * read-only without the edit capability.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  clampZoom,
  dragToMm,
  fitZoom,
  isTypingTarget,
  LH_GUIDES,
  lhGuidePercent,
  ZOOM_LIMITS,
  type LhDragAxis,
  type LhGuideKey,
} from "./brand-identity-state";

export function useBrandLetterheadZoom({
  canEdit,
  onGuideCommitted,
}: {
  canEdit: boolean;
  onGuideCommitted: (key: LhGuideKey, mm: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pan, setPan] = useState(false);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [scale, setScale] = useState(1);
  const zoomRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const next = fitZoom(frame.clientWidth, frame.clientHeight);
    setScale(next.scale);
    setX(next.x);
    setY(next.y);
  }, []);

  const closeZoom = useCallback(() => {
    setPan(false);
    setOpen(false);
  }, []);

  // Open: fit the page, lock body scroll, Space pans, Esc closes.
  useEffect(() => {
    if (!open) {
      setPan(false);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(fit);

    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeZoom();
        return;
      }
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      if (!e.repeat) setPan(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      setPan(false);
    };

    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
    };
  }, [open, fit, closeZoom]);

  function paintGuide(key: LhGuideKey, n: number) {
    const root = zoomRef.current;
    if (!root) return;
    root.style.setProperty(LH_GUIDES[key].cssVar, lhGuidePercent(key, n));
    const field = root.querySelector<HTMLInputElement>(`[data-lh-input="${key}"]`);
    if (field) field.value = String(n);
  }

  function startDrag(ev: ReactMouseEvent<HTMLDivElement>, key: LhGuideKey, axis: LhDragAxis) {
    if (!canEdit) return;
    ev.preventDefault();
    // The paper's rect already reflects the zoom scale, so millimetres stay exact.
    const box = ev.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    let dragged = 0;
    let moved = false;
    const move = (e: MouseEvent) => {
      dragged = dragToMm(axis, e.clientX, e.clientY, box);
      moved = true;
      paintGuide(key, dragged);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (moved) onGuideCommitted(key, dragged);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startPan(ev: ReactMouseEvent) {
    ev.preventDefault();
    const sx = ev.clientX;
    const sy = ev.clientY;
    let nx = x;
    let ny = y;
    const move = (e: MouseEvent) => {
      nx = x + (e.clientX - sx);
      ny = y + (e.clientY - sy);
      const paper = paperRef.current;
      if (paper) paper.style.transform = `translate(${nx}px, ${ny}px) scale(${scale})`;
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setX(nx);
      setY(ny);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return {
    open,
    pan,
    x,
    y,
    scale,
    zoomRef,
    paperRef,
    frameRef,
    openZoom: () => setOpen(true),
    closeZoom,
    fit,
    zoomIn: () => setScale((s) => clampZoom(s + ZOOM_LIMITS.step)),
    zoomOut: () => setScale((s) => clampZoom(s - ZOOM_LIMITS.step)),
    actualSize: () => setScale(1),
    startDrag,
    startPan,
  };
}

export type BrandLetterheadZoom = ReturnType<typeof useBrandLetterheadZoom>;
