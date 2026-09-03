"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModal, Button, cn, useToast } from "@platform/ui-kit";
import {
  INSPECTOR_FREE_PHOTO_CATEGORIES,
  canDeleteInspectorFreePhoto,
  inspectorFreePhotoUploader,
  inspectorFreePhotoUploaderLabel,
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  type InspectorFreePhoto,
  type InspectorFreePhotoUploader,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import { freePhotoRef } from "./InspectorDefinedPhotosSection";

/**
 * «تصوير العقار» — general property photography in step 1.
 *
 * Inspector: add/delete own photos; classify untagged photos here (see the image first).
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
  const [classifyPhotoId, setClassifyPhotoId] = useState<number | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | undefined>();
  const [classifyDataUrl, setClassifyDataUrl] = useState<string | undefined>();
  const stamp = inspectorPhotoStampText(draft);
  const photos = draft.freePhotos;
  const canUpload = !disabled;

  const untagged = useMemo(
    () => photos.filter((photo) => !photo.category),
    [photos],
  );
  const tagged = useMemo(
    () => photos.filter((photo) => Boolean(photo.category)),
    [photos],
  );

  const previewPhoto = useMemo(
    () => photos.find((photo) => photo.id === previewPhotoId) ?? null,
    [photos, previewPhotoId],
  );
  const classifyPhoto = useMemo(
    () => photos.find((photo) => photo.id === classifyPhotoId) ?? null,
    [photos, classifyPhotoId],
  );
  const previewRefKey = previewPhoto ? freePhotoRef(previewPhoto.id) : null;
  const classifyRefKey = classifyPhoto ? freePhotoRef(classifyPhoto.id) : null;

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

  useEffect(() => {
    if (!classifyPhoto || !classifyRefKey) {
      setClassifyDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(draft.taskId, classifyRefKey);
    if (cached) {
      setClassifyDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(draft.taskId, classifyRefKey, classifyPhoto).then(
      (url) => {
        if (!cancelled) setClassifyDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft.taskId, classifyPhoto, classifyRefKey]);

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
    let firstUntaggedId: number | null = null;
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
        if (firstUntaggedId === null) firstUntaggedId = id;
        added = true;
      }
      if (added) {
        onPatch({ freePhotos: working.freePhotos });
        onDirty?.();
        if (firstUntaggedId !== null && actor === "inspector") {
          setClassifyPhotoId(firstUntaggedId);
        }
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
    if (classifyPhotoId === id) setClassifyPhotoId(null);
    if (previewPhotoId === id) setPreviewPhotoId(null);
    showToast("تم حذف الصورة.", "success");
  }

  function tagPhoto(photoId: number, category: string) {
    const nextPhotos = photos.map((photo) =>
      photo.id === photoId ? { ...photo, category, approved: true } : photo,
    );
    onPatch({ freePhotos: nextPhotos });
    onDirty?.();
    const label =
      INSPECTOR_FREE_PHOTO_CATEGORIES.find((cat) => cat.key === category)
        ?.label ?? category;
    showToast(`عُرّفت الصورة: ${label}`, "success");

    const nextUntagged = nextPhotos.find(
      (photo) => photo.id !== photoId && !photo.category,
    );
    setClassifyPhotoId(nextUntagged?.id ?? null);
  }

  function openPhoto(photo: InspectorFreePhoto) {
    if (!photo.category && !disabled && canDeleteInspectorFreePhoto(photo, actor)) {
      setClassifyPhotoId(photo.id);
      return;
    }
    setPreviewPhotoId(photo.id);
  }

  const gridClass = cn(
    "grid gap-3",
    mobile
      ? "grid-cols-[repeat(auto-fill,minmax(110px,1fr))]"
      : "grid-cols-[repeat(auto-fill,minmax(132px,1fr))]",
  );

  function renderPhotoCard(photo: InspectorFreePhoto) {
    const uploader = inspectorFreePhotoUploader(photo);
    const deletable = !disabled && canDeleteInspectorFreePhoto(photo, actor);
    const needsClassify = !photo.category;
    const ownerBadge =
      !deletable || hasMixedUploaders
        ? inspectorFreePhotoUploaderLabel(uploader)
        : undefined;
    const category = photo.category
      ? INSPECTOR_FREE_PHOTO_CATEGORIES.find((cat) => cat.key === photo.category)
      : undefined;

    return (
      <div key={photo.id} className="flex flex-col gap-1.5">
        <InspectorStampedPhotoThumb
          stamp={stamp}
          taskId={draft.taskId}
          photoRef={freePhotoRef(photo.id)}
          attachment={photo}
          ownerBadge={ownerBadge}
          onClear={deletable ? () => remove(photo.id) : undefined}
          onClick={() => openPhoto(photo)}
          className={cn(
            "w-full [&_button:first-child]:!h-[100px] [&_button:first-child]:!w-full",
          )}
        />
        {needsClassify ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => openPhoto(photo)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-semibold text-heading hover:border-primary hover:text-primary disabled:opacity-50"
          >
            تحديد النوع
          </button>
        ) : (
          <p className="m-0 truncate text-center text-[11px] text-text-3">
            {category ? (
              <>
                <i className={`ti ${category.icon} me-1`} aria-hidden />
                {category.label}
              </>
            ) : (
              "معرّفة"
            )}
          </p>
        )}
      </div>
    );
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
        <div className="mt-4 space-y-4">
          {untagged.length > 0 ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="m-0 text-[12px] font-bold text-heading">
                  بانتظار التعريف
                </p>
                <p className="m-0 text-[11px] text-text-3">
                  {untagged.length} · اضغط الصورة أو «تحديد النوع»
                </p>
              </div>
              <div className={gridClass}>{untagged.map(renderPhotoCard)}</div>
            </div>
          ) : null}

          {tagged.length > 0 ? (
            <div>
              {untagged.length > 0 ? (
                <p className="m-0 mb-2 text-[12px] font-bold text-heading">
                  معرّفة
                </p>
              ) : null}
              <div className={gridClass}>{tagged.map(renderPhotoCard)}</div>
            </div>
          ) : null}

          {hasReadOnlyPhotos ? (
            <p className="m-0 text-[11px] leading-relaxed text-text-3">
              صور {readOnlyOtherPartyLabel} للعرض فقط — لا يمكن حذفها.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-text-3">
          {actor === "specialist"
            ? "لم تُضف صور بعد — صور المعاين تظهر هنا للمراجعة، ويمكنك إضافة صورك."
            : "التقط صور العقار العامة هنا، ثم حدّد نوع كل صورة بعد رؤيتها. صور توثيق الخدمات/المرافق تُرفع لاحقاً في خاناتها."}
        </p>
      )}

      <AppModal
        open={classifyPhoto !== null}
        title="تحديد نوع الصورة"
        onClose={() => setClassifyPhotoId(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {classifyPhoto &&
            !disabled &&
            canDeleteInspectorFreePhoto(classifyPhoto, actor) ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => remove(classifyPhoto.id)}
              >
                حذف
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setClassifyPhotoId(null)}
            >
              لاحقاً
            </Button>
          </div>
        }
      >
        {classifyDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={classifyDataUrl}
            alt={classifyPhoto?.fileName ?? "صورة العقار"}
            className="mx-auto mb-4 block max-h-[min(48vh,400px)] w-full rounded-lg object-contain"
          />
        ) : (
          <div className="mb-4 flex h-[220px] items-center justify-center rounded-lg bg-surface-2 text-[13px] text-text-3">
            جاري تحميل المعاينة…
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {INSPECTOR_FREE_PHOTO_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              disabled={disabled}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-3 text-[12px] font-semibold text-heading hover:border-primary hover:bg-surface-2 hover:text-primary disabled:opacity-50"
              onClick={() =>
                classifyPhotoId !== null
                  ? tagPhoto(classifyPhotoId, cat.key)
                  : undefined
              }
            >
              <i className={`ti ${cat.icon} text-xl text-primary`} aria-hidden />
              {cat.label}
            </button>
          ))}
        </div>
        {untagged.length > 1 ? (
          <p className="mb-0 mt-3 text-center text-[11px] text-text-3">
            بعد الاختيار تُفتح الصورة التالية تلقائياً
          </p>
        ) : null}
      </AppModal>

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
            {previewPhoto.category
              ? ` · ${
                  INSPECTOR_FREE_PHOTO_CATEGORIES.find(
                    (cat) => cat.key === previewPhoto.category,
                  )?.label ?? previewPhoto.category
                }`
              : ""}
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
