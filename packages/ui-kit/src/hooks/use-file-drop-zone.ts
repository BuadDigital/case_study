"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";

/**
 * How far the zone's events are kept from its parents: `"drag"` stops the drag events
 * (so a page-level drop target does not also take the file), `"all"` stops the click and
 * the Enter / Space press too.
 */
export type FileDropZoneIsolation = "none" | "drag" | "all";

/**
 * A dashed «choose or drop a file» zone over a hidden `<input type="file">`: click, Enter
 * or Space opens the picker, dropping files hands them over, and `dragOver` lights the zone
 * while a file hovers. `disabled` blocks picking, dropping and the highlight.
 * Spread `zoneProps` on the zone and put `inputRef` on the file input.
 */
export function useFileDropZone({
  onFiles,
  disabled = false,
  isolate = "none",
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  isolate?: FileDropZoneIsolation;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };
  const holdDrag = (e: DragEvent) => {
    e.preventDefault();
    if (isolate !== "none") e.stopPropagation();
  };
  const lightUp = (e: DragEvent) => {
    holdDrag(e);
    if (!disabled) setDragOver(true);
  };

  return {
    dragOver,
    inputRef,
    openPicker,
    zoneProps: {
      onClick: (e: MouseEvent) => {
        if (isolate === "all") e.stopPropagation();
        openPicker();
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isolate === "all") e.stopPropagation();
          inputRef.current?.click();
        }
      },
      onDragEnter: lightUp,
      onDragOver: lightUp,
      onDragLeave: (e: DragEvent) => {
        holdDrag(e);
        // Leaving into a child element is not leaving the zone — avoids flicker.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      },
      onDrop: (e: DragEvent) => {
        holdDrag(e);
        setDragOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      },
    },
  };
}
