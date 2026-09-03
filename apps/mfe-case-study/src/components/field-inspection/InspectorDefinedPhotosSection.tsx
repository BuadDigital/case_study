"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
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
} from "@platform/ui-kit";
import {
  inspectorPhotoStampText,
  listServiceAmenityPhotoSlots,
  nextInspectorPhotoId,
  isServiceAmenityPhotoSlotComplete,
  type InspectorDefinedPhotoSlot,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  inspectorPhotoAttachmentFromTransactionDoc,
  openInspectorPhotoPreview,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";

type Patch = Partial<Pick<InspectorWorkspaceDraft, "definedPhotos">>;
type PreviewRef = { kind: "slot"; slotId: string; photoId: number };

function slotPhotoRef(slotId: string, photoId: number): string {
  return `slot:${slotId}:${photoId}`;
}

export function freePhotoRef(photoId: number): string {
  return `free:${photoId}`;
}

/**
 * Bare section — always nested inside a parent card (InspectorCard / InsCard),
 * so it renders no outer chrome of its own.
 */
export function InspectorDefinedPhotosSection({
  draft,
  disabled,
  onPatch,
  layout = "desktop",
  transactionPhotos,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Patch) => void;
  /** `desktop` = Case Study.html c9 tiles (100px); `mobile` = square photoTile grid. */
  layout?: "desktop" | "mobile";
  /** When set (case-study specialist), empty slots can pick from transaction images. */
  transactionPhotos?: PropertyDetailDocumentEntry[];
}) {
  const { showToast } = useToast();
  const [previewRef, setPreviewRef] = useState<PreviewRef | null>(null);
  const [uploading, setUploading] = useState(false);

  const stamp = inspectorPhotoStampText(draft);

  const visibleSlots = useMemo(
    () => listServiceAmenityPhotoSlots(draft),
    [draft.services, draft.amenities],
  );

  const canPickFromTransaction = Boolean(
    transactionPhotos && transactionPhotos.length > 0,
  );

  const previewPhoto = useMemo(() => {
    if (!previewRef) return null;
    return draft.definedPhotos[previewRef.slotId]?.photos.find(
      (photo) => photo.id === previewRef.photoId,
    );
  }, [draft, previewRef]);

  const previewRefKey = previewRef
    ? slotPhotoRef(previewRef.slotId, previewRef.photoId)
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
    let lastError: string | null = null;

    try {
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
          lastError = result.error;
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
      if (lastError) throw new Error(lastError);
      return added > 0;
    } finally {
      setUploading(false);
    }
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

  function selectTransactionPhoto(
    slotId: string,
    doc: PropertyDetailDocumentEntry,
  ) {
    if (disabled) return;
    const nextId = nextInspectorPhotoId(draft);
    const attachment = inspectorPhotoAttachmentFromTransactionDoc(
      draft.taskId,
      slotPhotoRef(slotId, nextId),
      doc,
    );
    patchDefinedPhotos(slotId, () => ({
      none: false,
      photos: [
        {
          id: nextId,
          approved: true,
          ...attachment,
        },
      ],
    }));
  }

  function approvePreviewPhoto() {
    if (!previewRef || !previewPhoto) return;
    patchDefinedPhotos(previewRef.slotId, (slot) => ({
      ...slot,
      photos: slot.photos.map((photo) =>
        photo.id === previewRef.photoId
          ? { ...photo, approved: true }
          : photo,
      ),
    }));
    setPreviewRef(null);
    showToast("تم اعتماد الصورة");
  }

  function deletePreviewPhoto() {
    if (!previewRef) return;
    deleteSlotPhoto(previewRef.slotId, previewRef.photoId);
    setPreviewRef(null);
    showToast("تم حذف الصورة");
  }

  return (
    <>
      <RegistrationFormCard>
        {layout === "desktop" ? (
          <p className="mb-3 text-[11px] leading-relaxed text-text-3">
            {canPickFromTransaction
              ? "لكل خدمة/مرفق اخترته أعلاه تظهر خانة صورة واحدة. يمكن رفع ملف أو اختيار صورة من مرفقات المعاملة (مثل إثبات الكهرباء والماء)."
              : "لكل خدمة/مرفق اخترته في القسم أعلاه: ارفع صورة توثيقية (كاميرا أو ملف). بدون اختيار لا تظهر خانات."}
          </p>
        ) : (
          <p className="mb-2.5 text-[11px] leading-relaxed text-text-3">
            {canPickFromTransaction
              ? "وثّق كل خدمة/مرفق. ارفع صورة أو اختر من مرفقات المعاملة."
              : "وثّق كل خدمة/مرفق اخترته. اضغط الخانة للتصوير أو اختيار ملف."}
          </p>
        )}

        {visibleSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3.5 py-5 text-center text-[12px] text-text-3">
            اختر خدمة أو مرفقاً من «الخدمات والمرافق المحيطة» أولاً — تظهر
            هنا خانة صورة لكل اختيار.
          </div>
        ) : layout === "mobile" ? (
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
                  <div key={def.id} className="flex flex-col gap-1">
                    <DesktopHtmlPhotoTile
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
                    {canPickFromTransaction && !slot.none ? (
                      <InspectorPhotoFilePicker
                        label={done ? "تغيير من المعاملة" : "من صور المعاملة"}
                        compact
                        disabled={Boolean(disabled || uploading)}
                        transactionPhotos={transactionPhotos}
                        onTransactionPhotoSelected={(doc) =>
                          selectTransactionPhoto(def.id, doc)
                        }
                        onFilesSelected={(files) =>
                          uploadSlotPhotos(def.id, files)
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
        )}
      </RegistrationFormCard>

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
 * Desktop c9 tile: clear upload CTA; "not available" secondary.
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
