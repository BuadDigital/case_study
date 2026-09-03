"use client";

import { useCallback, useState, type DragEvent } from "react";

export const INSPECTOR_PHOTO_ACCEPT =
  "image/*,.heic,.heif,image/jpeg,image/png,image/webp";

export function filterInspectorPhotoFiles(
  files: FileList | File[] | null | undefined,
): File[] {
  return Array.from(files ?? []).filter((file) => {
    const type = (file.type || "").toLowerCase();
    if (type.startsWith("image/")) return true;
    const name = file.name.toLowerCase();
    return (
      name.endsWith(".heic") ||
      name.endsWith(".heif") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp")
    );
  });
}

export function useInspectorPhotoDropZone(options: {
  disabled?: boolean;
  onFiles: (files: File[]) => void | boolean | Promise<void | boolean>;
}) {
  const { disabled, onFiles } = options;
  const [dragOver, setDragOver] = useState(false);

  const onDragEnter = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = filterInspectorPhotoFiles(e.dataTransfer.files);
      if (files.length > 0) void onFiles(files);
    },
    [disabled, onFiles],
  );

  return {
    dragOver,
    dropZoneProps: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}
