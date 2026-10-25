"use client";

import { useFileDropZone } from "@platform/ui-kit";

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

/**
 * Drag-and-drop only (the photo pickers own their click): the design-system
 * `useFileDropZone` with the drop filtered to photos. Drag events stay in the zone.
 */
export function useInspectorPhotoDropZone(options: {
  disabled?: boolean;
  onFiles: (files: File[]) => void | boolean | Promise<void | boolean>;
}) {
  const { disabled, onFiles } = options;
  const { dragOver, zoneProps } = useFileDropZone({
    disabled,
    isolate: "drag",
    onFiles: (list) => {
      const files = filterInspectorPhotoFiles(list);
      if (files.length > 0) void onFiles(files);
    },
  });
  const { onDragEnter, onDragOver, onDragLeave, onDrop } = zoneProps;
  return { dragOver, dropZoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
