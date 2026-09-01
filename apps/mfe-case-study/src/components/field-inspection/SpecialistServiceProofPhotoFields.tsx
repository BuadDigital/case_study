"use client";

import { useMemo, useState } from "react";
import { AppModal, Button, cn } from "@platform/ui-kit";
import {
  isPropertyDetailDocumentAvailable,
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";
import {
  isServiceAmenityPhotoSlotComplete,
  listSpecialistProofServicePhotoSlots,
  nextInspectorPhotoId,
  serviceAmenityPhotoSlotId,
  type InspectorDefinedPhotoSlot,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import {
  getInspectorPhotoDataUrl,
  setInspectorPhotoDataUrl,
} from "../../lib/prototype/inspector-photo-upload";
import { INS_LABEL_CLASS } from "./FieldInspectionWorkParts";

function slotPhotoRef(slotId: string, photoId: number): string {
  return `slot:${slotId}:${photoId}`;
}

function mimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function proofLabel(serviceLabel: string): string {
  return serviceLabel === "كهرباء"
    ? "صورة إثبات الكهرباء"
    : "صورة إثبات الماء";
}

export function SpecialistServiceProofPhotoFields({
  draft,
  transactionPhotos,
  disabled = false,
  invalid = false,
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  transactionPhotos: PropertyDetailDocumentEntry[];
  disabled?: boolean;
  invalid?: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const slots = useMemo(
    () => listSpecialistProofServicePhotoSlots(draft),
    [draft.services],
  );
  const availablePhotos = useMemo(
    () =>
      transactionPhotos.filter(
        (photo) => photo.kind === "image" && isPropertyDetailDocumentAvailable(photo),
      ),
    [transactionPhotos],
  );
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const pickerSlot = slots.find((slot) => slot.id === pickerSlotId) ?? null;

  if (slots.length === 0) return null;

  function patchSlot(
    slotId: string,
    updater: (slot: InspectorDefinedPhotoSlot) => InspectorDefinedPhotoSlot,
  ) {
    const current = draft.definedPhotos[slotId] ?? { none: false, photos: [] };
    onPatch({
      definedPhotos: {
        ...draft.definedPhotos,
        [slotId]: updater(current),
      },
    });
  }

  function selectPhoto(slotId: string, doc: PropertyDetailDocumentEntry) {
    const nextId = nextInspectorPhotoId(draft);
    const photo: InspectorSlotPhoto = {
      id: nextId,
      approved: true,
      fileName: doc.fileName,
      mimeType: mimeFromFileName(doc.fileName),
      attachmentId: doc.attachmentId?.trim() || doc.id,
    };
    if (doc.dataUrl) {
      setInspectorPhotoDataUrl(
        draft.taskId,
        slotPhotoRef(slotId, nextId),
        doc.dataUrl,
      );
    }
    patchSlot(slotId, () => ({ none: false, photos: [photo] }));
    setPickerSlotId(null);
  }

  function clearPhoto(slotId: string) {
    patchSlot(slotId, () => ({ none: false, photos: [] }));
  }

  return (
    <>
      <div
        id="ins-defined-photos"
        className={cn(
          "mt-3 rounded-lg border px-3 py-3",
          invalid ? "border-danger bg-danger-bg/40" : "border-border bg-surface-2",
        )}
      >
        <p className="mb-2.5 text-[11px] leading-relaxed text-text-3">
          عند اختيار <strong>كهرباء</strong> أو <strong>ماء</strong> يجب اختيار
          صورة إثبات من صور المعاملة.
        </p>
        <div className="flex flex-col gap-2.5">
          {slots.map((slot) => {
            const current = draft.definedPhotos[slot.id] ?? {
              none: false,
              photos: [],
            };
            const selected = current.photos[0];
            const done = isServiceAmenityPhotoSlotComplete(current);
            const previewUrl = selected
              ? getInspectorPhotoDataUrl(
                  draft.taskId,
                  slotPhotoRef(slot.id, selected.id),
                ) ?? transactionPhotos.find(
                  (p) =>
                    p.fileName === selected.fileName ||
                    p.attachmentId === selected.attachmentId ||
                    p.id === selected.attachmentId,
                )?.dataUrl
              : undefined;

            return (
              <div
                key={slot.id}
                className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2"
              >
                <div className="min-w-[140px] flex-1">
                  <span
                    className={cn(
                      INS_LABEL_CLASS,
                      !done && "text-danger",
                    )}
                  >
                    {proofLabel(slot.label)}
                    {!done ? (
                      <span className="ms-1 text-[10px] font-bold text-danger">
                        مطلوب
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <p className="m-0 truncate text-[10.5px] text-text-3">
                      {selected.fileName}
                    </p>
                  ) : null}
                </div>
                {previewUrl ? (
                  <button
                    type="button"
                    className="relative h-[52px] w-[72px] shrink-0 overflow-hidden rounded-md border border-border"
                    onClick={() => {
                      const doc = transactionPhotos.find(
                        (p) => p.dataUrl === previewUrl,
                      );
                      if (doc) openPropertyDetailDocumentPreview(doc);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={selected?.fileName ?? slot.label}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : null}
                {!disabled ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPickerSlotId(slot.id)}
                    >
                      {done ? "تغيير الصورة" : "اختر من صور المعاملة"}
                    </Button>
                    {done ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => clearPhoto(slot.id)}
                      >
                        إزالة
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <AppModal
        open={Boolean(pickerSlot)}
        title={
          pickerSlot
            ? `اختر ${proofLabel(pickerSlot.label)}`
            : "اختر صورة إثبات"
        }
        onClose={() => setPickerSlotId(null)}
        footer={
          <Button type="button" variant="ghost" onClick={() => setPickerSlotId(null)}>
            إغلاق
          </Button>
        }
      >
        {availablePhotos.length === 0 ? (
          <p className="m-0 text-[13px] text-text-3">
            لا توجد صور متاحة في مستندات/صور المعاملة بعد.
          </p>
        ) : (
          <div className="grid max-h-[min(420px,60vh)] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto">
            {availablePhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="overflow-hidden rounded-lg border border-border bg-surface-2 p-0 text-start hover:border-gold"
                onClick={() =>
                  pickerSlot && selectPhoto(pickerSlot.id, photo)
                }
              >
                <div className="relative h-[88px] w-full bg-surface-2">
                  {photo.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.dataUrl}
                      alt={photo.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-text-3">
                      معاينة
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="truncate text-[11px] font-semibold text-heading">
                    {photo.name}
                  </div>
                  <div className="truncate text-[10px] text-text-3">
                    {photo.source}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </AppModal>
    </>
  );
}

/** Drop proof-photo slots when a specialist proof service is deselected. */
export function withoutSpecialistProofSlots(
  draft: Pick<InspectorWorkspaceDraft, "definedPhotos">,
  removedServices: readonly string[],
): InspectorWorkspaceDraft["definedPhotos"] {
  let next = draft.definedPhotos;
  for (const label of removedServices) {
    const slotId = serviceAmenityPhotoSlotId("service", label);
    if (!(slotId in next)) continue;
    const { [slotId]: _, ...rest } = next;
    next = rest;
  }
  return next;
}
