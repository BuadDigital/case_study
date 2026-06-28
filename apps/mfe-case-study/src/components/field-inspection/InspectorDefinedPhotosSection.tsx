"use client";

import { useEffect, useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  Badge,
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
  useToast,
} from "@platform/design-system";
import {
  INSPECTOR_DEFINED_PHOTOS,
  INSPECTOR_FREE_PHOTO_CATEGORIES,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  type InspectorDefinedPhotoSlot,
  type InspectorFreePhoto,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  openInspectorPhotoPreview,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/prototype/inspector-photo-upload";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import { InspectorToggleSwitch } from "./InspectorToggleSwitch";

type PreviewRef =
  | { kind: "slot"; slotId: string; photoId: number }
  | { kind: "free"; photoId: number };

type Patch = Partial<Pick<InspectorWorkspaceDraft, "definedPhotos" | "freePhotos">>;

function slotPhotoRef(slotId: string, photoId: number): string {
  return `slot:${slotId}:${photoId}`;
}

function freePhotoRef(photoId: number): string {
  return `free:${photoId}`;
}

function MiniPhotoThumb({
  taskId,
  photoRef,
  photo,
  stamp,
  icon,
  onClick,
  onDelete,
}: {
  taskId: string;
  photoRef: string;
  photo: InspectorSlotPhoto | InspectorFreePhoto;
  stamp: string;
  icon?: string;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [dataUrl, setDataUrl] = useState(
    () => getInspectorPhotoDataUrl(taskId, photoRef),
  );

  useEffect(() => {
    let cancelled = false;
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    void prefetchInspectorPhoto(taskId, photoRef, photo).then((url) => {
      if (!cancelled && url) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, photoRef, photo]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-[60px] w-[84px] shrink-0 overflow-hidden rounded-md border bg-cover bg-center text-[10px]",
        photo.approved
          ? "border-success"
          : "border-dashed border-amber",
      )}
      style={dataUrl ? { backgroundImage: `url(${dataUrl})` } : undefined}
    >
      {!dataUrl ? (
        <span
          className={cn(
            "flex h-full flex-col items-center justify-center",
            photo.approved
              ? "bg-success-bg text-teal-text"
              : "bg-amber-light text-amber-text",
          )}
        >
          <i className={`ti ${icon ?? "ti-photo"} text-lg`} aria-hidden />
        </span>
      ) : null}
      <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-0.5 py-0.5 text-[8px] text-white">
        {photo.approved ? "✓ " : "⏲ "}
        {stamp}
      </span>
      <span
        role="button"
        tabIndex={0}
        className="absolute -start-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-danger-text shadow-sm hover:bg-danger-surface"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }
        }}
      >
        <span className="text-sm font-bold leading-none" aria-hidden>
          ×
        </span>
      </span>
    </button>
  );
}

export function InspectorDefinedPhotosSection({
  draft,
  disabled,
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Patch) => void;
}) {
  const { showToast } = useToast();
  const [previewRef, setPreviewRef] = useState<PreviewRef | null>(null);
  const [pickerPhotoId, setPickerPhotoId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const stamp = inspectorPhotoStampText(draft);
  const coverageLabel = inspectorPhotoCoverageLabel(draft);
  const showAnnex = draft.hasAnnex === "نعم";
  const untaggedFree = draft.freePhotos.filter((photo) => !photo.category);

  const visibleSlots = useMemo(
    () =>
      INSPECTOR_DEFINED_PHOTOS.filter(
        (def) => !def.annexOnly || showAnnex,
      ),
    [showAnnex],
  );

  const previewPhoto = useMemo(() => {
    if (!previewRef) return null;
    if (previewRef.kind === "slot") {
      return draft.definedPhotos[previewRef.slotId]?.photos.find(
        (photo) => photo.id === previewRef.photoId,
      );
    }
    return draft.freePhotos.find((photo) => photo.id === previewRef.photoId);
  }, [draft, previewRef]);

  const previewRefKey = previewRef
    ? previewRef.kind === "slot"
      ? slotPhotoRef(previewRef.slotId, previewRef.photoId)
      : freePhotoRef(previewRef.photoId)
    : null;

  const [previewDataUrl, setPreviewDataUrl] = useState<string | undefined>();

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
    void prefetchInspectorPhoto(
      draft.taskId,
      previewRefKey,
      previewPhoto,
    ).then(setPreviewDataUrl);
  }, [draft.taskId, previewPhoto, previewRefKey]);

  function patchDefinedPhotos(
    slotId: string,
    updater: (slot: InspectorDefinedPhotoSlot) => InspectorDefinedPhotoSlot,
  ) {
    const current = draft.definedPhotos[slotId];
    if (!current) return;
    onPatch({
      definedPhotos: {
        ...draft.definedPhotos,
        [slotId]: updater(current),
      },
    });
  }

  async function uploadSlotPhotos(slotId: string, files: File[]) {
    if (disabled || uploading) return false;
    setUploading(true);
    let added = 0;
    let workingDraft = draft;

    for (const file of files) {
      const nextId = nextInspectorPhotoId(workingDraft);
      const ref = slotPhotoRef(slotId, nextId);
      const result = await uploadInspectorPhotoFromFile(
        draft.taskId,
        ref,
        file,
        { stampText: inspectorPhotoStampText(workingDraft) },
      );
      if (!result.ok) {
        showToast(result.error, "error");
        continue;
      }

      const slot = workingDraft.definedPhotos[slotId] ?? {
        none: false,
        photos: [],
      };
      const nextPhoto: InspectorSlotPhoto = {
        id: nextId,
        approved: true,
        ...result.attachment,
      };
      workingDraft = {
        ...workingDraft,
        definedPhotos: {
          ...workingDraft.definedPhotos,
          [slotId]: {
            none: false,
            photos: [...slot.photos, nextPhoto],
          },
        },
      };
      added += 1;
    }

    if (added > 0) {
      onPatch({ definedPhotos: workingDraft.definedPhotos });
    }
    setUploading(false);
    return added > 0;
  }

  function deleteSlotPhoto(slotId: string, photoId: number) {
    clearInspectorPhotoDataUrl(draft.taskId, slotPhotoRef(slotId, photoId));
    patchDefinedPhotos(slotId, (slot) => ({
      ...slot,
      photos: slot.photos.filter((photo) => photo.id !== photoId),
    }));
  }

  function toggleSlotNone(slotId: string, none: boolean) {
    if (none) {
      for (const photo of draft.definedPhotos[slotId]?.photos ?? []) {
        clearInspectorPhotoDataUrl(
          draft.taskId,
          slotPhotoRef(slotId, photo.id),
        );
      }
    }
    patchDefinedPhotos(slotId, () =>
      none ? { none: true, photos: [] } : { none: false, photos: [] },
    );
  }

  async function uploadFreePhotos(files: File[]) {
    if (disabled || uploading) return false;
    setUploading(true);
    let workingDraft = draft;
    let lastId: number | null = null;

    for (const file of files) {
      const nextId = nextInspectorPhotoId(workingDraft);
      const ref = freePhotoRef(nextId);
      const result = await uploadInspectorPhotoFromFile(
        draft.taskId,
        ref,
        file,
        { stampText: inspectorPhotoStampText(workingDraft) },
      );
      if (!result.ok) {
        showToast(result.error, "error");
        continue;
      }

      const nextPhoto: InspectorFreePhoto = {
        id: nextId,
        category: null,
        approved: false,
        ...result.attachment,
      };
      workingDraft = {
        ...workingDraft,
        freePhotos: [...workingDraft.freePhotos, nextPhoto],
      };
      lastId = nextId;
    }

    if (lastId !== null) {
      onPatch({ freePhotos: workingDraft.freePhotos });
      setPickerPhotoId(lastId);
    }
    setUploading(false);
    return lastId !== null;
  }

  function tagFreePhoto(photoId: number, category: string) {
    onPatch({
      freePhotos: draft.freePhotos.map((photo) =>
        photo.id === photoId
          ? { ...photo, category, approved: true }
          : photo,
      ),
    });
    const label =
      INSPECTOR_FREE_PHOTO_CATEGORIES.find((cat) => cat.key === category)
        ?.label ?? category;
    showToast(`عُرّفت الصورة: ${label}`);
    setPickerPhotoId(null);
  }

  function deleteFreePhoto(photoId: number) {
    clearInspectorPhotoDataUrl(draft.taskId, freePhotoRef(photoId));
    onPatch({
      freePhotos: draft.freePhotos.filter((photo) => photo.id !== photoId),
    });
  }

  function approvePreviewPhoto() {
    if (!previewRef || !previewPhoto) return;
    if (previewRef.kind === "slot") {
      patchDefinedPhotos(previewRef.slotId, (slot) => ({
        ...slot,
        photos: slot.photos.map((photo) =>
          photo.id === previewRef.photoId
            ? { ...photo, approved: true }
            : photo,
        ),
      }));
    } else {
      onPatch({
        freePhotos: draft.freePhotos.map((photo) =>
          photo.id === previewRef.photoId
            ? { ...photo, approved: true }
            : photo,
        ),
      });
    }
    setPreviewRef(null);
    showToast("تم اعتماد الصورة");
  }

  function deletePreviewPhoto() {
    if (!previewRef) return;
    if (previewRef.kind === "slot") {
      deleteSlotPhoto(previewRef.slotId, previewRef.photoId);
    } else {
      deleteFreePhoto(previewRef.photoId);
    }
    setPreviewRef(null);
    showToast("تم حذف الصورة");
  }

  return (
    <>
      <RegistrationFormCard
        title="صور العقار الموثّقة"
        headerRight={
          <div className="flex items-center gap-2">
            <i className="ti ti-camera-plus text-base text-primary" aria-hidden />
            <Badge tone="default">{coverageLabel}</Badge>
          </div>
        }
      >
        <p className="mb-3.5 text-[11px] leading-relaxed text-text-3">
          ارفع الصور من جهازك (كاميرا أو معرض). لكل خانة: ارفع صورتها أو فعّل
          «لا يوجد». الصور الإضافية تُعرّف بنوعها بنقرة.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSlots.map((def) => {
            const slot = draft.definedPhotos[def.id] ?? {
              none: false,
              photos: [],
            };
            const incompleteRequired =
              def.required && !slot.none && !slot.photos.some((p) => p.approved);

            return (
              <div
                key={def.id}
                className={cn(
                  "rounded-lg border bg-surface-2 p-3.5",
                  incompleteRequired
                    ? "border-[#F5CBA7]"
                    : "border-border",
                )}
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text">
                    <i className={`ti ${def.icon} text-primary-light text-base`} aria-hidden />
                    {def.name}
                  </span>
                  <Badge tone={def.required ? "danger" : "default"}>
                    {def.required ? "مطلوب" : "اختياري"}
                  </Badge>
                </div>

                {slot.none ? (
                  <div className="mb-2 flex items-center gap-1.5 rounded-md bg-surface-3 px-3 py-2 text-xs font-semibold text-text-2">
                    <i className="ti ti-circle-minus" aria-hidden />
                    لا يوجد في هذا العقار
                  </div>
                ) : slot.photos.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {slot.photos.map((photo) => (
                      <MiniPhotoThumb
                        key={photo.id}
                        taskId={draft.taskId}
                        photoRef={slotPhotoRef(def.id, photo.id)}
                        photo={photo}
                        stamp={stamp}
                        icon={def.icon}
                        onClick={() =>
                          setPreviewRef({
                            kind: "slot",
                            slotId: def.id,
                            photoId: photo.id,
                          })
                        }
                        onDelete={() => deleteSlotPhoto(def.id, photo.id)}
                      />
                    ))}
                  </div>
                ) : null}

                {!slot.none ? (
                  <InspectorPhotoFilePicker
                    label={
                      slot.photos.length > 0
                        ? "صورة أخرى"
                        : "رفع صورة (متعدد)"
                    }
                    disabled={disabled || uploading}
                    multiple
                    className={slot.photos.length === 0 ? "w-full justify-center" : undefined}
                    onFilesSelected={(files) =>
                      uploadSlotPhotos(def.id, files)
                    }
                  />
                ) : null}

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-2">
                    <i className="ti ti-ban text-sm" aria-hidden /> لا يوجد
                  </span>
                  <InspectorToggleSwitch
                    checked={slot.none}
                    disabled={disabled}
                    ariaLabel={`لا يوجد — ${def.name}`}
                    onChange={(none) => toggleSlotNone(def.id, none)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-2.5 mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
            <i className="ti ti-photo-plus text-primary" aria-hidden />
            صور إضافية
          </div>
          <InspectorPhotoFilePicker
            label="رفع صور إضافية"
            disabled={disabled || uploading}
            multiple
            className="w-auto"
            onFilesSelected={uploadFreePhotos}
          />
        </div>

        {untaggedFree.length > 0 ? (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-orange bg-orange-bg px-3 py-2 text-[11px] font-semibold text-orange">
            <i className="ti ti-alert-triangle" aria-hidden />
            {untaggedFree.length} صورة بحاجة لتعريف — اضغط عليها لتحديد نوعها
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {draft.freePhotos.map((photo) => {
            if (!photo.category) {
              return (
                <button
                  key={photo.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPickerPhotoId(photo.id)}
                  className="relative flex h-[60px] w-[84px] shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-orange bg-orange-bg text-orange"
                >
                  <i className="ti ti-photo text-xl" aria-hidden />
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 truncate rounded bg-orange px-0.5 text-[9px] font-bold text-white">
                    {photo.fileName}
                  </span>
                  <span className="absolute left-0.5 top-8 rounded bg-orange px-0.5 text-[8px] font-bold text-white">
                    عرّفني
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="absolute -start-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-danger-text shadow-sm hover:bg-danger-surface"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFreePhoto(photo.id);
                    }}
                  >
                    <span className="text-sm font-bold leading-none" aria-hidden>
                      ×
                    </span>
                  </span>
                </button>
              );
            }

            const category = INSPECTOR_FREE_PHOTO_CATEGORIES.find(
              (cat) => cat.key === photo.category,
            );
            return (
              <MiniPhotoThumb
                key={photo.id}
                taskId={draft.taskId}
                photoRef={freePhotoRef(photo.id)}
                photo={photo}
                stamp={stamp}
                icon={category?.icon}
                onClick={() =>
                  setPreviewRef({ kind: "free", photoId: photo.id })
                }
                onDelete={() => deleteFreePhoto(photo.id)}
              />
            );
          })}
        </div>
      </RegistrationFormCard>

      {pickerPhotoId !== null ? (
        <ModalOverlay onClick={() => setPickerPhotoId(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle className="flex items-center justify-center gap-2 text-right">
                <i className="ti ti-tag text-primary" aria-hidden />
                ما نوع هذه الصورة؟
              </ModalTitle>
              <ModalClose onClick={() => setPickerPhotoId(null)} aria-label="إغلاق">
                ×
              </ModalClose>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {INSPECTOR_FREE_PHOTO_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    disabled={disabled}
                    className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-3 text-[11px] text-text-2 hover:border-primary hover:text-primary"
                    onClick={() => tagFreePhoto(pickerPhotoId, cat.key)}
                  >
                    <i className={`ti ${cat.icon} text-lg text-primary`} aria-hidden />
                    {cat.label}
                  </button>
                ))}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerPhotoId(null)}
              >
                لاحقاً
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {previewRef && previewPhoto ? (
        <ModalOverlay onClick={() => setPreviewRef(null)}>
          <ModalCard wide onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle className="flex items-center justify-center gap-2 text-right">
                <i className="ti ti-eye text-primary" aria-hidden />
                معاينة الصورة قبل الاعتماد
              </ModalTitle>
              <ModalClose onClick={() => setPreviewRef(null)} aria-label="إغلاق">
                ×
              </ModalClose>
            </ModalHeader>
            <ModalBody>
              <div className="mb-3 flex justify-center">
                <Badge tone={previewPhoto.approved ? "success" : "warning"}>
                  {previewPhoto.approved ? (
                    <>
                      <i className="ti ti-circle-check" aria-hidden /> معتمدة
                    </>
                  ) : (
                    <>
                      <i className="ti ti-clock" aria-hidden /> بانتظار الاعتماد
                    </>
                  )}
                </Badge>
              </div>
              {previewDataUrl ? (
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-lg border border-border"
                  onClick={() => openInspectorPhotoPreview(previewDataUrl)}
                >
                  <img
                    src={previewDataUrl}
                    alt={previewPhoto.fileName}
                    className="max-h-[420px] w-full object-contain"
                  />
                </button>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-lg bg-surface-2 text-text-3">
                  جاري تحميل المعاينة…
                </div>
              )}
              <p className="mt-2 text-center text-[11px] text-text-3">
                {previewPhoto.fileName} · {stamp}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={disabled}
                onClick={deletePreviewPhoto}
              >
                <i className="ti ti-trash" aria-hidden /> حذف (غير واضحة)
              </Button>
              {!previewPhoto.approved ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={disabled}
                  onClick={approvePreviewPhoto}
                >
                  <i className="ti ti-check" aria-hidden /> اعتماد الصورة
                </Button>
              ) : null}
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </>
  );
}
