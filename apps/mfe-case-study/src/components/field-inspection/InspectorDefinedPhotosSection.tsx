"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  INSPECTOR_FREE_PHOTO_CATEGORIES,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  listServiceAmenityPhotoSlots,
  nextInspectorPhotoId,
  isServiceAmenityPhotoSlotComplete,
  type InspectorDefinedPhotoSlot,
  type InspectorFreePhoto,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
  type ServiceAmenityPhotoSlotDef,
} from "../../lib/prototype/inspector-workspace-data";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/prototype/inspector-photo-drop";
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
    }).catch(() => {
      if (!cancelled) setDataUrl(undefined);
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
  bare = false,
  layout = "desktop",
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Patch) => void;
  /** Skip outer card chrome when nested in a parent section. */
  bare?: boolean;
  /** `desktop` = Case Study.html c9 tiles (100px); `mobile` = square photoTile grid. */
  layout?: "desktop" | "mobile";
}) {
  const { showToast } = useToast();
  const [previewRef, setPreviewRef] = useState<PreviewRef | null>(null);
  const [pickerPhotoId, setPickerPhotoId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const stamp = inspectorPhotoStampText(draft);
  const coverageLabel = inspectorPhotoCoverageLabel(draft);
  const untaggedFree = draft.freePhotos.filter((photo) => !photo.category);

  const visibleSlots = useMemo(
    () => listServiceAmenityPhotoSlots(draft),
    [draft.services, draft.amenities],
  );

  function slotIcon(def: ServiceAmenityPhotoSlotDef): string {
    return def.kind === "service" ? "ti-plug" : "ti-map-pin";
  }

  function slotKindBadge(def: ServiceAmenityPhotoSlotDef): string {
    return def.kind === "service" ? "خدمة" : "مرفق";
  }

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
    const current = draft.definedPhotos[slotId] ?? {
      none: false,
      photos: [],
    };
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
        { draft: workingDraft },
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
        { draft: workingDraft },
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
        title={bare ? undefined : "توثيق الخدمات والمرافق"}
        headerRight={
          bare ? undefined : (
            <div className="flex items-center gap-2">
              <i className="ti ti-camera-plus text-base text-primary" aria-hidden />
              <Badge tone="default">{coverageLabel}</Badge>
            </div>
          )
        }
      >
        {bare && layout === "desktop" ? (
          <p className="mb-3 text-[11px] leading-relaxed text-text-3">
            لكل خدمة/مرفق اخترته في القسم أعلاه: ارفع صورة توثيقية (كاميرا أو
            ملف). بدون اختيار لا تظهر خانات.
          </p>
        ) : null}
        {bare && layout === "mobile" ? (
          <p className="mb-2.5 text-[11px] leading-relaxed text-text-3">
            وثّق كل خدمة/مرفق اخترته. اضغط الخانة للتصوير أو اختيار ملف.
          </p>
        ) : null}
        {bare ? null : (
          <p className="mb-3.5 text-[11px] leading-relaxed text-text-3">
            الخانات تعكس اختيارك من «الخدمات» و«المرافق». ارفع صورة لكل عنصر، أو
            «غير متوفر» إن تعذّر التوثيق في الموقع.
          </p>
        )}

        {visibleSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3.5 py-5 text-center text-[12px] text-text-3">
            اختر خدمة أو مرفقاً من «الخدمات والمرافق المحيطة» أولاً — تظهر
            هنا خانة صورة لكل اختيار.
          </div>
        ) : bare ? (
          layout === "mobile" ? (
            <div className="grid grid-cols-3 gap-2.5">
              {visibleSlots.map((def) => {
                const slot = draft.definedPhotos[def.id] ?? {
                  none: false,
                  photos: [],
                };
                const done = isServiceAmenityPhotoSlotComplete(slot);
                return (
                  <MobilePhotoTile
                    key={def.id}
                    label={def.label}
                    required
                    done={done}
                    none={slot.none}
                    disabled={Boolean(disabled || uploading)}
                    onUpload={(files) => uploadSlotPhotos(def.id, files)}
                    onToggleNone={() => toggleSlotNone(def.id, !slot.none)}
                    onOpenDone={
                      slot.photos[0]
                        ? () =>
                            setPreviewRef({
                              kind: "slot",
                              slotId: def.id,
                              photoId: slot.photos[0]!.id,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {visibleSlots.map((def) => {
                const slot = draft.definedPhotos[def.id] ?? {
                  none: false,
                  photos: [],
                };
                const first = slot.photos[0];
                const done = isServiceAmenityPhotoSlotComplete(slot);
                return (
                  <DesktopHtmlPhotoTile
                    key={def.id}
                    label={def.label}
                    required
                    done={done}
                    none={slot.none}
                    taskId={draft.taskId}
                    photoRef={
                      first
                        ? slotPhotoRef(def.id, first.id)
                        : undefined
                    }
                    photo={first}
                    disabled={Boolean(disabled || uploading)}
                    onUpload={(files) => uploadSlotPhotos(def.id, files)}
                    onToggleNone={() => toggleSlotNone(def.id, !slot.none)}
                    onOpen={
                      first
                        ? () =>
                            setPreviewRef({
                              kind: "slot",
                              slotId: def.id,
                              photoId: first.id,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSlots.map((def) => {
            const slot = draft.definedPhotos[def.id] ?? {
              none: false,
              photos: [],
            };
            const incomplete =
              !isServiceAmenityPhotoSlotComplete(slot);

            return (
              <div
                key={def.id}
                className={cn(
                  "rounded-lg border bg-surface-2 p-3.5",
                  incomplete
                    ? "border-[#F5CBA7]"
                    : "border-border",
                )}
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text">
                    <i className={`ti ${slotIcon(def)} text-primary-light text-base`} aria-hidden />
                    {def.label}
                  </span>
                  <Badge tone="danger">{slotKindBadge(def)}</Badge>
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
                        icon={slotIcon(def)}
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
                    disabled={disabled}
                    loading={uploading}
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
                    ariaLabel={`لا يوجد — ${def.label}`}
                    onChange={(none) => toggleSlotNone(def.id, none)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        )}

        <div
          className={cn(
            "mb-2.5 mt-5 flex flex-wrap items-center justify-between gap-2",
            bare && "mt-4",
            bare && layout === "desktop" && "hidden",
          )}
        >
          {bare ? null : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
              <i className="ti ti-photo-plus text-primary" aria-hidden />
              صور إضافية
            </div>
          )}
          <InspectorPhotoFilePicker
            label={bare ? "صور إضافية" : "رفع صور إضافية"}
            disabled={disabled}
            loading={uploading}
            multiple
            className={cn(
              bare
                ? "w-full [&_button]:min-h-11 [&_button]:rounded-xl [&_button]:border-[1.5px] [&_button]:border-dashed [&_button]:border-[var(--gold-d,#a4906f)] [&_button]:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] [&_button]:text-[13px] [&_button]:font-bold [&_button]:text-[var(--gold-d,#a4906f)]"
                : "w-auto",
            )}
            onFilesSelected={uploadFreePhotos}
          />
        </div>

        {untaggedFree.length > 0 && !(bare && layout === "desktop") ? (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-orange bg-orange-bg px-3 py-2 text-[11px] font-semibold text-orange">
            <i className="ti ti-alert-triangle" aria-hidden />
            {untaggedFree.length} صورة بحاجة لتعريف — اضغط عليها لتحديد نوعها
          </div>
        ) : null}

        {!(bare && layout === "desktop") ? (
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
        ) : null}
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

/** Mobile square photo cell. */
function MobilePhotoTile({
  label,
  required = true,
  done,
  none,
  disabled,
  onUpload,
  onToggleNone,
  onOpenDone,
}: {
  label: string;
  required?: boolean;
  done: boolean;
  none: boolean;
  disabled?: boolean;
  onUpload: (files: File[]) => boolean | void | Promise<boolean | void>;
  onToggleNone: () => void;
  onOpenDone?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const dropBlocked = Boolean(disabled || none);
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: dropBlocked,
    onFiles: (files) => runWithUploadToast(() => onUpload(files)),
  });

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] p-2 font-inherit",
          done
            ? "border-solid border-border bg-surface-2"
            : "border-dashed border-[var(--border-md,#ddd8cc)] bg-surface",
          dragOver && "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
        )}
        {...dropZoneProps}
        onClick={() => {
          if (done && onOpenDone) {
            onOpenDone();
            return;
          }
          if (none) {
            onToggleNone();
            return;
          }
          inputRef.current?.click();
        }}
      >
        {done ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1f6f6f" strokeWidth="1.6" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m4 17 5-5 4 4 3-2 4 4" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold-d,#a4906f)" strokeWidth="1.8" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        <span className="text-center text-[11px] leading-tight text-text-2">
          {dragOver
            ? "أفلِت الصورة"
            : none
              ? `غير متوفر · ${label}`
              : label}
        </span>
        {!required && !none ? (
          <span className="text-[9px] font-semibold text-text-3">اختياري</span>
        ) : null}
        {done ? (
          <span className="absolute start-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[#1f9d6f] text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        className="text-center text-[10px] font-medium text-text-3 underline-offset-2 hover:underline"
        onClick={onToggleNone}
      >
        {none ? "إلغاء «غير متوفر»" : "غير متوفر هنا"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = filterInspectorPhotoFiles(e.target.files);
          e.target.value = "";
          if (files.length > 0) {
            void runWithUploadToast(() => onUpload(files));
          }
        }}
      />
    </div>
  );
}

/**
 * Desktop c9 tile: clear upload CTA; «غير متوفر» secondary.
 */
function DesktopHtmlPhotoTile({
  label,
  required = true,
  done,
  none,
  taskId,
  photoRef,
  photo,
  disabled,
  onUpload,
  onToggleNone,
  onOpen,
}: {
  label: string;
  required?: boolean;
  done: boolean;
  none: boolean;
  taskId: string;
  photoRef?: string;
  photo?: InspectorSlotPhoto;
  disabled?: boolean;
  onUpload: (files: File[]) => boolean | void | Promise<boolean | void>;
  onToggleNone: () => void;
  onOpen?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const dropBlocked = Boolean(disabled || none);
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: dropBlocked,
    onFiles: (files) => runWithUploadToast(() => onUpload(files)),
  });
  const [dataUrl, setDataUrl] = useState(
    () =>
      photoRef ? getInspectorPhotoDataUrl(taskId, photoRef) : undefined,
  );

  useEffect(() => {
    if (!photoRef || !photo) {
      setDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, photo).then((url) => {
      if (!cancelled && url) setDataUrl(url);
    }).catch(() => {
      if (!cancelled) setDataUrl(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, photoRef, photo]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={disabled}
        title={
          none
            ? "اضغط لإلغاء «غير متوفر»"
            : dragOver
              ? "أفلِت الصور هنا"
              : done
                ? "معاينة — أو اسحب صوراً إضافية"
                : "رفع صورة — اسحب وأفلت أو اضغط"
        }
        className={cn(
          "relative grid h-[108px] w-full place-items-center overflow-hidden rounded-lg border font-inherit",
          none
            ? "border-dashed border-border bg-surface-2"
            : done
              ? "border-solid border-border bg-surface-2"
              : "border-dashed border-[var(--gold-d,#a4906f)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
          dragOver &&
            "border-primary bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]",
          !disabled && "cursor-pointer",
        )}
        style={
          dataUrl && !none && !dragOver
            ? {
                backgroundImage: `url(${dataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        {...dropZoneProps}
        onClick={() => {
          if (none) {
            onToggleNone();
            return;
          }
          if (done && onOpen) {
            onOpen();
            return;
          }
          inputRef.current?.click();
        }}
      >
        {!dataUrl || none ? (
          none ? (
            <span className="flex flex-col items-center gap-0.5 pb-4 text-center">
              <span className="text-[11px] font-semibold text-text-3">غير متوفر</span>
              <span className="text-[9px] text-text-3">اضغط للإلغاء</span>
            </span>
          ) : done ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-3)"
              strokeWidth="1.5"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m4 17 5-5 4 4 3-2 4 4" />
            </svg>
          ) : dragOver ? (
            <span className="flex flex-col items-center gap-1 px-1.5 pb-5 text-center">
              <i className="ti ti-upload text-xl text-primary" aria-hidden />
              <span className="text-[11px] font-bold text-primary">
                أفلِت الصور هنا
              </span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-1 px-1.5 pb-5 text-center">
              <i className="ti ti-camera-plus text-xl text-[var(--gold-d,#a4906f)]" aria-hidden />
              <span className="text-[11px] font-bold text-[var(--gold-d,#a4906f)]">
                ارفع صورة
              </span>
              <span className="text-[9px] font-normal text-text-3">
                أو اسحب وأفلت
              </span>
            </span>
          )
        ) : null}
        <span className="absolute inset-x-0 bottom-0 bg-[rgba(16,43,78,0.78)] px-1.5 py-[3px] text-center text-[9.5px] text-white">
          {label}
          {!required ? (
            <span className="ms-1 opacity-80">· اختياري</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="py-0.5 text-center text-[10px] font-medium text-text-3 underline-offset-2 hover:text-text-2 hover:underline"
        onClick={onToggleNone}
      >
        {none ? "إلغاء «غير متوفر»" : "غير متوفر هنا"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = filterInspectorPhotoFiles(e.target.files);
          e.target.value = "";
          if (files.length > 0) {
            void runWithUploadToast(() => onUpload(files));
          }
        }}
      />
    </div>
  );
}
