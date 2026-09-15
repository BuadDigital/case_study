"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModal, Button, cn, useToast } from "@platform/ui-kit";
import {
  INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
  INSPECTOR_FREE_PHOTO_CATEGORY_INTERIOR,
  INSPECTOR_FREE_PHOTO_KINDS,
  INSPECTOR_FREE_PHOTO_PARENTS,
  buildInspectorFreePhotoCategory,
  canDeleteInspectorFreePhoto,
  inspectorFreePhotoCategoryMeta,
  inspectorFreePhotoKindsForParent,
  inspectorFreePhotoNeedsKind,
  inspectorFreePhotoParentKey,
  inspectorFreePhotoUploader,
  inspectorFreePhotoUploaderLabel,
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  parseInspectorFreePhotoCategory,
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

type ParentKey =
  | typeof INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR
  | typeof INSPECTOR_FREE_PHOTO_CATEGORY_INTERIOR;

/**
 * «تصوير العقار» — two on-page buckets (خارجية / داخلية).
 * Drop into a bucket, then classify every photo (واجهة / خدمة / مرفق / أخرى).
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
  actor?: InspectorFreePhotoUploader;
  onPatch: (patch: Partial<Pick<InspectorWorkspaceDraft, "freePhotos">>) => void;
  onDirty?: () => void;
  mobile?: boolean;
}) {
  const { showToast } = useToast();
  const [uploadingParent, setUploadingParent] = useState<ParentKey | null>(null);
  const [previewPhotoId, setPreviewPhotoId] = useState<number | null>(null);
  const [classifyPhotoId, setClassifyPhotoId] = useState<number | null>(null);
  /** Parent locked when dropping into a bucket; null for legacy untagged. */
  const [classifyParent, setClassifyParent] = useState<ParentKey | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | undefined>();
  const [classifyDataUrl, setClassifyDataUrl] = useState<string | undefined>();
  const stamp = inspectorPhotoStampText(draft);
  const photos = draft.freePhotos;
  const canUpload = !disabled;
  const uploading = uploadingParent !== null;

  const photosByParent = useMemo(() => {
    const map = new Map<string, InspectorFreePhoto[]>();
    for (const parent of INSPECTOR_FREE_PHOTO_PARENTS) {
      map.set(parent.key, []);
    }
    const orphan: InspectorFreePhoto[] = [];
    for (const photo of photos) {
      const parent = inspectorFreePhotoParentKey(photo.category);
      if (parent && map.has(parent)) {
        map.get(parent)!.push(photo);
      } else {
        orphan.push(photo);
      }
    }
    return { map, orphan };
  }, [photos]);

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
    const uploaders = new Set(
      photos.map((photo) => inspectorFreePhotoUploader(photo)),
    );
    return uploaders.size > 1;
  }, [photos]);

  const readOnlyOtherPartyLabel =
    actor === "specialist" ? "المعاين" : "الأخصائي";
  const hasReadOnlyPhotos = photos.some(
    (photo) => !canDeleteInspectorFreePhoto(photo, actor),
  );

  function needsKindClassify(photo: InspectorFreePhoto): boolean {
    return inspectorFreePhotoNeedsKind(photo.category);
  }

  async function upload(files: File[], parent: ParentKey) {
    if (!canUpload || uploading) return false;
    setUploadingParent(parent);
    let working = draft;
    let added = false;
    let lastError: string | null = null;
    let firstId: number | null = null;
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
        // Parent is known from the bucket; kind stays pending so each photo
        // can be identified (واجهة / خدمة / مرفق / أخرى) instead of dumping
        // the rest of a multi-upload as «أخرى».
        const photo: InspectorFreePhoto = {
          id,
          category: parent,
          approved: true,
          uploadedBy: actor,
          ...result.attachment,
        };
        working = { ...working, freePhotos: [...working.freePhotos, photo] };
        if (firstId === null) firstId = id;
        added = true;
      }
      if (added) {
        onPatch({ freePhotos: working.freePhotos });
        onDirty?.();
        if (firstId !== null && actor === "inspector") {
          setClassifyParent(parent);
          setClassifyPhotoId(firstId);
        }
      }
      if (lastError) throw new Error(lastError);
      return added;
    } finally {
      setUploadingParent(null);
    }
  }

  function remove(id: number) {
    const photo = photos.find((item) => item.id === id);
    if (!photo || disabled || !canDeleteInspectorFreePhoto(photo, actor)) return;
    onPatch({ freePhotos: photos.filter((item) => item.id !== id) });
    onDirty?.();
    if (classifyPhotoId === id) {
      setClassifyPhotoId(null);
      setClassifyParent(null);
    }
    if (previewPhotoId === id) setPreviewPhotoId(null);
    showToast("تم حذف الصورة.", "success");
  }

  function tagKind(
    photoId: number,
    kindKey: string,
    parentOverride?: ParentKey,
    options?: { advance?: boolean; toast?: boolean },
  ) {
    const photo = photos.find((item) => item.id === photoId);
    if (!photo) return;
    const parent =
      parentOverride ??
      classifyParent ??
      (inspectorFreePhotoParentKey(photo.category) as ParentKey | null);
    if (!parent) return;

    const category = buildInspectorFreePhotoCategory(parent, kindKey);
    const nextPhotos = photos.map((item) =>
      item.id === photoId ? { ...item, category, approved: true } : item,
    );
    onPatch({ freePhotos: nextPhotos });
    onDirty?.();
    if (options?.toast !== false) {
      const label = inspectorFreePhotoCategoryMeta(category)?.label ?? category;
      showToast(`عُرّفت الصورة: ${label}`, "success");
    }

    const shouldAdvance = options?.advance !== false;
    if (!shouldAdvance) {
      if (classifyPhotoId === photoId) {
        setClassifyPhotoId(null);
        setClassifyParent(null);
      }
      return;
    }

    const nextPending = nextPhotos.find(
      (item) =>
        item.id !== photoId &&
        inspectorFreePhotoParentKey(item.category) === parent &&
        inspectorFreePhotoNeedsKind(item.category),
    );
    if (nextPending) {
      setClassifyParent(parent);
      setClassifyPhotoId(nextPending.id);
    } else {
      setClassifyPhotoId(null);
      setClassifyParent(null);
    }
  }

  function openPhoto(photo: InspectorFreePhoto) {
    if (
      needsKindClassify(photo) &&
      !disabled &&
      canDeleteInspectorFreePhoto(photo, actor)
    ) {
      const parent = inspectorFreePhotoParentKey(photo.category) as ParentKey | null;
      setClassifyParent(parent);
      setClassifyPhotoId(photo.id);
      return;
    }
    setPreviewPhotoId(photo.id);
  }

  function closeClassify() {
    setClassifyPhotoId(null);
    setClassifyParent(null);
  }

  const gridClass = cn(
    "grid gap-3",
    mobile
      ? "grid-cols-[repeat(auto-fill,minmax(110px,1fr))]"
      : "grid-cols-[repeat(auto-fill,minmax(132px,1fr))]",
  );

  const classifyKindsParent =
    classifyParent ??
    (classifyPhoto
      ? (inspectorFreePhotoParentKey(classifyPhoto.category) as ParentKey | null)
      : null);

  function renderPhotoCard(photo: InspectorFreePhoto, parentHint?: ParentKey) {
    const uploader = inspectorFreePhotoUploader(photo);
    const deletable = !disabled && canDeleteInspectorFreePhoto(photo, actor);
    const pendingKind = needsKindClassify(photo);
    const ownerBadge =
      !deletable || hasMixedUploaders
        ? inspectorFreePhotoUploaderLabel(uploader)
        : undefined;
    const parent =
      parentHint ??
      (inspectorFreePhotoParentKey(photo.category) as ParentKey | null);
    const parsed = parseInspectorFreePhotoCategory(photo.category);
    const kindOptions = inspectorFreePhotoKindsForParent(parent);
    const kindMeta = parsed
      ? kindOptions.find((k) => k.key === parsed.kind) ??
        INSPECTOR_FREE_PHOTO_KINDS.find((k) => k.key === parsed.kind)
      : null;
    const fallback = inspectorFreePhotoCategoryMeta(photo.category);
    const display = kindMeta ?? fallback;
    const canEditKind = deletable && parent !== null;

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
        {canEditKind ? (
          <select
            aria-label="نوع الصورة"
            disabled={disabled}
            className={cn(
              "h-8 w-full rounded-md border bg-surface px-1.5 text-center text-[11px] font-semibold",
              pendingKind
                ? "border-primary text-primary"
                : "border-border text-heading",
            )}
            value={parsed?.kind ?? ""}
            onChange={(e) => {
              const kind = e.target.value;
              if (!kind) return;
              tagKind(photo.id, kind, parent, { advance: false, toast: false });
            }}
          >
            <option value="" disabled>
              تحديد النوع
            </option>
            {kindOptions.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </select>
        ) : pendingKind ? (
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
            {display ? (
              <>
                <i className={`ti ${display.icon} me-1`} aria-hidden />
                {display.label}
              </>
            ) : (
              "معرّفة"
            )}
          </p>
        )}
      </div>
    );
  }

  function renderBucket(parent: (typeof INSPECTOR_FREE_PHOTO_PARENTS)[number]) {
    const bucketPhotos = photosByParent.map.get(parent.key) ?? [];
    const pendingInBucket = bucketPhotos.filter(needsKindClassify);
    const doneInBucket = bucketPhotos.filter((p) => !needsKindClassify(p));
    const busy = uploadingParent === parent.key;
    const isExterior = parent.key === INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR;

    return (
      <div
        key={parent.key}
        className="rounded-lg border border-border bg-surface-2/40 px-3 py-3"
      >
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="m-0 flex items-center gap-1.5 text-[13px] font-bold text-heading">
            <i className={`ti ${parent.icon} text-primary`} aria-hidden />
            {parent.label}
          </p>
          <p className="m-0 text-[11px] text-text-3">
            {inspectorPhotosLabel(bucketPhotos.length)}
          </p>
        </div>

        <InspectorPhotoFilePicker
          label={
            bucketPhotos.length > 0
              ? `إضافة صورة ${isExterior ? "خارجية" : "داخلية"}`
              : `التقاط صورة ${isExterior ? "خارجية" : "داخلية"}`
          }
          disabled={!canUpload || (uploading && !busy)}
          loading={busy}
          multiple
          onFilesSelected={(files) => upload(files, parent.key as ParentKey)}
        />

        {pendingInBucket.length > 0 ? (
          <div className="mt-3">
            <p className="m-0 mb-2 text-[11px] font-semibold text-text-3">
              بانتظار النوع · {pendingInBucket.length}
            </p>
            <div className={gridClass}>
              {pendingInBucket.map((photo) =>
                renderPhotoCard(photo, parent.key as ParentKey),
              )}
            </div>
          </div>
        ) : null}

        {doneInBucket.length > 0 ? (
          <div className={cn(gridClass, pendingInBucket.length > 0 ? "mt-3" : "mt-3")}>
            {doneInBucket.map((photo) =>
              renderPhotoCard(photo, parent.key as ParentKey),
            )}
          </div>
        ) : bucketPhotos.length === 0 ? (
          <p className="m-0 mt-2 text-[11px] leading-relaxed text-text-3">
            {isExterior
              ? "ارفع صور الواجهات والمحيط الخارجي، ثم حدّد نوع كل صورة: واجهة / خدمة / مرفق / أخرى."
              : "ارفع صور الفراغات الداخلية، ثم حدّد نوع كل صورة: خدمة / مرفق / أخرى."}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {INSPECTOR_FREE_PHOTO_PARENTS.map(renderBucket)}
      </div>

      {photosByParent.orphan.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="m-0 text-[12px] font-bold text-heading">
              بانتظار التصنيف
            </p>
            <p className="m-0 text-[11px] text-text-3">
              اختر خارجية أو داخلية، ثم حدّد نوع كل صورة
            </p>
          </div>
          <div className={gridClass}>
            {photosByParent.orphan.map(renderPhotoCard)}
          </div>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-text-3">
          {actor === "specialist"
            ? "لم تُضف صور بعد — صور المعاين تظهر هنا للمراجعة، ويمكنك إضافة صورك في القسم المناسب."
            : "ارفع في «صور خارجية» أو «صور داخلية»، ثم حدّد نوع كل صورة."}
        </p>
      ) : null}

      {hasReadOnlyPhotos ? (
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-text-3">
          صور {readOnlyOtherPartyLabel} للعرض فقط — لا يمكن حذفها.
        </p>
      ) : null}

      <AppModal
        open={classifyPhoto !== null}
        title={
          classifyKindsParent
            ? `تحديد النوع · ${
                INSPECTOR_FREE_PHOTO_PARENTS.find(
                  (p) => p.key === classifyKindsParent,
                )?.label ?? ""
              }`
            : "تحديد نوع الصورة"
        }
        onClose={closeClassify}
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
            <Button type="button" variant="ghost" onClick={closeClassify}>
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

        {classifyKindsParent ? (
          <div
            className={cn(
              "grid gap-2",
              inspectorFreePhotoKindsForParent(classifyKindsParent).length > 3
                ? "grid-cols-2"
                : "grid-cols-3",
            )}
          >
            {inspectorFreePhotoKindsForParent(classifyKindsParent).map((kind) => (
              <button
                key={kind.key}
                type="button"
                disabled={disabled}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-3 text-[12px] font-semibold text-heading hover:border-primary hover:bg-surface-2 hover:text-primary disabled:opacity-50"
                onClick={() =>
                  classifyPhotoId !== null
                    ? tagKind(classifyPhotoId, kind.key)
                    : undefined
                }
              >
                <i
                  className={`ti ${kind.icon} text-xl text-primary`}
                  aria-hidden
                />
                {kind.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {INSPECTOR_FREE_PHOTO_PARENTS.map((parent) => (
              <div
                key={parent.key}
                className="rounded-lg border border-border bg-surface-2/40 px-3 py-3"
              >
                <p className="m-0 mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-heading">
                  <i className={`ti ${parent.icon} text-primary`} aria-hidden />
                  {parent.label}
                </p>
                <div
                  className={cn(
                    "grid gap-2",
                    inspectorFreePhotoKindsForParent(parent.key).length > 3
                      ? "grid-cols-2"
                      : "grid-cols-3",
                  )}
                >
                  {inspectorFreePhotoKindsForParent(parent.key).map((kind) => (
                    <button
                      key={kind.key}
                      type="button"
                      disabled={disabled}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-3 text-[12px] font-semibold text-heading hover:border-primary hover:bg-surface-2 hover:text-primary disabled:opacity-50"
                      onClick={() => {
                        if (classifyPhotoId === null) return;
                        tagKind(
                          classifyPhotoId,
                          kind.key,
                          parent.key as ParentKey,
                        );
                      }}
                    >
                      <i
                        className={`ti ${kind.icon} text-xl text-primary`}
                        aria-hidden
                      />
                      {kind.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
                  inspectorFreePhotoCategoryMeta(previewPhoto.category)?.label ??
                  previewPhoto.category
                }`
              : ""}
            {hasMixedUploaders ||
            !canDeleteInspectorFreePhoto(previewPhoto, actor)
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
