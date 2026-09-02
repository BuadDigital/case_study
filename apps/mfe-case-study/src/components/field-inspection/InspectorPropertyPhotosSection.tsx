"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModal, Button, cn, useToast } from "@platform/ui-kit";
import {
  canDeleteInspectorFreePhoto,
  inspectorFreePhotoUploader,
  inspectorFreePhotoUploaderLabel,
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  type InspectorFreePhoto,
  type InspectorFreePhotoUploader,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/prototype/inspector-photo-upload";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import { freePhotoRef } from "./InspectorDefinedPhotosSection";

/**
 * «تصوير العقار» — general property photography in step 1.
 *
 * Inspector: add/delete own photos; view specialist photos (no delete).
 * Specialist: view inspector photos (no delete); add/delete own supplemental photos.
 */
export function InspectorPropertyPhotosSection({
  draft,
  disabled,
  actor = "inspector",
  onPatch,
  onDirty,
  mobile,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  /** Who is using this section — controls upload ownership and delete permissions. */
  actor?: InspectorFreePhotoUploader;
  onPatch: (patch: Partial<Pick<InspectorWorkspaceDraft, "freePhotos">>) => void;
  onDirty?: () => void;
  mobile?: boolean;
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewPhotoId, setPreviewPhotoId] = useState<number | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | undefined>();
  const stamp = inspectorPhotoStampText(draft);
  const photos = draft.freePhotos;
  const canUpload = !disabled;

  const previewPhoto = useMemo(
    () => photos.find((photo) => photo.id === previewPhotoId) ?? null,
    [photos, previewPhotoId],
  );
  const previewRefKey = previewPhoto ? freePhotoRef(previewPhoto.id) : null;

  useEffect(() => {
    if (!previewPhoto || !previewRefKey) {
      setPreviewDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(draft.taskId, previewRefKey);
    if (cached) {
      setPreviewDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(draft.taskId, previewRefKey, previewPhoto).then(
      (url) => {
        if (!cancelled) setPreviewDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft.taskId, previewPhoto, previewRefKey]);

  const hasMixedUploaders = useMemo(() => {
    const uploaders = new Set(photos.map((photo) => inspectorFreePhotoUploader(photo)));
    return uploaders.size > 1;
  }, [photos]);

  const readOnlyOtherPartyLabel =
    actor === "specialist" ? "المعاين" : "الأخصائي";
  const hasReadOnlyPhotos = photos.some(
    (photo) => !canDeleteInspectorFreePhoto(photo, actor),
  );

  async function upload(files: File[]) {
    if (!canUpload || uploading) return false;
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
          uploadedBy: actor,
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
    const photo = photos.find((item) => item.id === id);
    if (!photo || disabled || !canDeleteInspectorFreePhoto(photo, actor)) return;
    onPatch({ freePhotos: photos.filter((item) => item.id !== id) });
    onDirty?.();
    showToast("تم حذف الصورة.", "success");
  }

  return (
    <>
      <InspectorPhotoFilePicker
        label={photos.length > 0 ? "إضافة صورة أخرى" : "التقاط صورة للعقار"}
        disabled={!canUpload}
        loading={uploading}
        multiple
        onFilesSelected={upload}
      />

      {photos.length > 0 ? (
        <>
          <div
            className={cn(
              "mt-3 grid gap-2.5",
              mobile
                ? "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]"
                : "grid-cols-[repeat(auto-fill,minmax(118px,1fr))]",
            )}
          >
            {photos.map((photo) => {
              const uploader = inspectorFreePhotoUploader(photo);
              const deletable = !disabled && canDeleteInspectorFreePhoto(photo, actor);
              const ownerBadge =
                !deletable || hasMixedUploaders
                  ? inspectorFreePhotoUploaderLabel(uploader)
                  : undefined;
              return (
                <InspectorStampedPhotoThumb
                  key={photo.id}
                  stamp={stamp}
                  compact
                  taskId={draft.taskId}
                  photoRef={freePhotoRef(photo.id)}
                  attachment={photo}
                  ownerBadge={ownerBadge}
                  onClear={deletable ? () => remove(photo.id) : undefined}
                  onClick={() => setPreviewPhotoId(photo.id)}
                />
              );
            })}
          </div>
          {hasReadOnlyPhotos ? (
            <p className="m-0 mt-2 text-[11px] leading-relaxed text-text-3">
              صور {readOnlyOtherPartyLabel} للعرض فقط — لا يمكن حذفها.
            </p>
          ) : null}
        </>
      ) : (
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-text-3">
          {actor === "specialist"
            ? "لم تُضف صور بعد — صور المعاين تظهر هنا للمراجعة، ويمكنك إضافة صورك."
            : "لم تُلتقط صور بعد — التقط صور العقار العامة هنا. صور الأخصائي الإضافية تظهر هنا للعرض عند إضافتها."}
        </p>
      )}

      <AppModal
        open={previewPhoto !== null}
        title="معاينة الصورة"
        onClose={() => setPreviewPhotoId(null)}
        footer={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPreviewPhotoId(null)}
          >
            إغلاق
          </Button>
        }
      >
        {previewDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewDataUrl}
            alt={previewPhoto?.fileName ?? "صورة العقار"}
            className="mx-auto block max-h-[min(70vh,560px)] w-full object-contain"
          />
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-lg bg-surface-2 text-[13px] text-text-3">
            جاري تحميل المعاينة…
          </div>
        )}
        {previewPhoto ? (
          <p className="mb-0 mt-3 text-center text-[11px] leading-relaxed text-text-3">
            {previewPhoto.fileName}
            {stamp ? ` · ${stamp}` : ""}
            {hasMixedUploaders || !canDeleteInspectorFreePhoto(previewPhoto, actor)
              ? ` · ${inspectorFreePhotoUploaderLabel(inspectorFreePhotoUploader(previewPhoto))}`
              : ""}
          </p>
        ) : null}
      </AppModal>
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
