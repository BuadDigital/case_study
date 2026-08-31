"use client";

import { useState } from "react";
import { cn, useToast } from "@platform/ui-kit";
import {
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  type InspectorFreePhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { uploadInspectorPhotoFromFile } from "../../lib/prototype/inspector-photo-upload";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import { freePhotoRef } from "./InspectorDefinedPhotosSection";

/**
 * «تصوير العقار» — general property photography in step 1.
 *
 * Writes the same untagged `freePhotos` array the documentation section in
 * step 3 reads, so a photo captured here can be categorised there later.
 */
export function InspectorPropertyPhotosSection({
  draft,
  disabled,
  onPatch,
  onDirty,
  mobile,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Partial<Pick<InspectorWorkspaceDraft, "freePhotos">>) => void;
  onDirty?: () => void;
  mobile?: boolean;
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const stamp = inspectorPhotoStampText(draft);
  const photos = draft.freePhotos;

  async function upload(files: File[]) {
    if (disabled || uploading) return false;
    setUploading(true);
    let working = draft;
    let added = false;
    let lastError: string | null = null;
    try {
      for (const file of files) {
        const id = nextInspectorPhotoId(working);
        const result = await uploadInspectorPhotoFromFile(
          draft.taskId,
          freePhotoRef(id),
          file,
          { draft: working },
        );
        if (!result.ok) {
          lastError = result.error;
          continue;
        }
        const photo: InspectorFreePhoto = {
          id,
          category: null,
          approved: false,
          ...result.attachment,
        };
        working = { ...working, freePhotos: [...working.freePhotos, photo] };
        added = true;
      }
      if (added) {
        onPatch({ freePhotos: working.freePhotos });
        onDirty?.();
      }
      if (lastError) throw new Error(lastError);
      return added;
    } finally {
      setUploading(false);
    }
  }

  function remove(id: number) {
    if (disabled) return;
    onPatch({ freePhotos: photos.filter((photo) => photo.id !== id) });
    onDirty?.();
    showToast("تم حذف الصورة.", "success");
  }

  return (
    <>
      <InspectorPhotoFilePicker
        label={photos.length > 0 ? "إضافة صورة أخرى" : "التقاط صورة للعقار"}
        disabled={disabled}
        loading={uploading}
        multiple
        onFilesSelected={upload}
      />

      {photos.length > 0 ? (
        <div
          className={cn(
            "mt-3 grid gap-2.5",
            mobile
              ? "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]"
              : "grid-cols-[repeat(auto-fill,minmax(118px,1fr))]",
          )}
        >
          {photos.map((photo) => (
            <InspectorStampedPhotoThumb
              key={photo.id}
              stamp={stamp}
              compact
              taskId={draft.taskId}
              photoRef={freePhotoRef(photo.id)}
              attachment={photo}
              onClear={disabled ? undefined : () => remove(photo.id)}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-text-3">
          لم تُلتقط صور بعد — التقط صور العقار العامة هنا، وصور الخدمات والملاحظات
          تُرفع في خطوة «التجهيز والإكمال».
        </p>
      )}
    </>
  );
}

/** «٣ صور» counter for the section header. */
export function inspectorPhotosLabel(count: number): string {
  if (count === 0) return "بدون صور";
  if (count === 1) return "صورة واحدة";
  if (count === 2) return "صورتان";
  if (count <= 10) return `${count} صور`;
  return `${count} صورة`;
}
