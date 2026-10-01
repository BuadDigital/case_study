"use client";

/**
 * Bare section — always nested inside a parent card (InspectorCard / InsCard),
 * so it renders no outer chrome of its own. Owns the slot mutations (upload,
 * delete, «غير متوفر», pick from the transaction); the grid itself is
 * `InspectorDefinedPhotoSlotList` and the
 * pure slot rules live in `inspector-wizard-state`.
 */
import { useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { requestDocumentPreview } from "@platform/app-shared/app-data/document-preview-store";
import {
  nextInspectorPhotoId,
  type InspectorDefinedPhotoSlot,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  inspectorPhotoAttachmentFromTransactionDoc,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import { InspectorDefinedPhotoSlotList } from "./InspectorDefinedPhotoSlotList";
import {
  definedPhotosIntroText,
  definedSlotNone,
  definedSlotReplacedBy,
  definedSlotWithPhoto,
  emptyDefinedPhotoSlot,
  listDefinedPhotoSlotCells,
  setDefinedPhotoSlot,
  slotPhotoRef,
} from "./inspector-wizard-state";

export { freePhotoRef } from "./inspector-wizard-state";

type Patch = Partial<Pick<InspectorWorkspaceDraft, "definedPhotos">>;

export function InspectorDefinedPhotosSection({
  draft,
  disabled,
  onPatch,
  layout = "desktop",
  transactionPhotos,
  invalidSlotId,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Patch) => void;
  /** `desktop` = Case Study.html c9 tiles (100px); `mobile` = square photoTile grid. */
  layout?: "desktop" | "mobile";
  /** When set (case-study specialist), empty slots can pick from transaction images. */
  transactionPhotos?: PropertyDetailDocumentEntry[];
  /** Slot the validator sent the user to — highlight only after a failed save. */
  invalidSlotId?: string;
}) {
  const [uploading, setUploading] = useState(false);

  const cells = useMemo(
    () => listDefinedPhotoSlotCells(draft),
    [draft.services, draft.amenities, draft.definedPhotos],
  );

  const canPickFromTransaction = Boolean(
    transactionPhotos && transactionPhotos.length > 0,
  );

  function openSlotPhoto(slotId: string, photoId: number) {
    const gallery = cells.flatMap((cell) =>
      (cell.slot.photos ?? []).map((photo) => ({
        id: `${cell.id}:${photo.id}`,
        fileName: photo.fileName,
        title: cell.label,
        kind: "image" as const,
        dataUrl: getInspectorPhotoDataUrl(
          draft.taskId,
          slotPhotoRef(cell.id, photo.id),
        ),
        attachmentId: photo.attachmentId,
      })),
    );
    const current = gallery.find((item) => item.id === `${slotId}:${photoId}`);
    if (!current || (!current.dataUrl && !current.attachmentId)) return;
    if (
      requestDocumentPreview({
        ...current,
        gallery: gallery.length > 1 ? gallery : undefined,
      })
    ) {
      return;
    }
    if (current.dataUrl) window.open(current.dataUrl, "_blank", "noopener,noreferrer");
  }

  function patchDefinedPhotos(
    slotId: string,
    updater: (slot: InspectorDefinedPhotoSlot) => InspectorDefinedPhotoSlot,
  ) {
    const current = draft.definedPhotos[slotId] ?? emptyDefinedPhotoSlot();
    onPatch({
      definedPhotos: setDefinedPhotoSlot(draft.definedPhotos, slotId, updater(current)),
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

        const slot = workingDraft.definedPhotos[slotId] ?? emptyDefinedPhotoSlot();
        const nextPhoto: InspectorSlotPhoto = {
          id: nextId,
          approved: true,
          ...result.attachment,
        };
        workingDraft = {
          ...workingDraft,
          definedPhotos: setDefinedPhotoSlot(
            workingDraft.definedPhotos,
            slotId,
            definedSlotWithPhoto(slot, nextPhoto),
          ),
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

  function toggleSlotNone(slotId: string, none: boolean) {
    if (none) {
      for (const photo of draft.definedPhotos[slotId]?.photos ?? []) {
        clearInspectorPhotoDataUrl(
          draft.taskId,
          slotPhotoRef(slotId, photo.id),
        );
      }
    }
    patchDefinedPhotos(slotId, () => definedSlotNone(none));
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
    patchDefinedPhotos(slotId, () =>
      definedSlotReplacedBy({ id: nextId, approved: true, ...attachment }),
    );
  }

  return (
    <>
      <RegistrationFormCard>
        {disabled ? null : (
          <p
            className={
              layout === "desktop"
                ? "mb-3 text-[11px] leading-relaxed text-text-3"
                : "mb-2.5 text-[11px] leading-relaxed text-text-3"
            }
          >
            {definedPhotosIntroText(layout, canPickFromTransaction)}
          </p>
        )}

        <InspectorDefinedPhotoSlotList
          cells={cells}
          layout={layout}
          taskId={draft.taskId}
          disabled={Boolean(disabled || uploading)}
          readOnly={Boolean(disabled)}
          transactionPhotos={canPickFromTransaction ? transactionPhotos : undefined}
          onUpload={uploadSlotPhotos}
          onToggleNone={toggleSlotNone}
          onOpen={openSlotPhoto}
          onSelectTransactionPhoto={selectTransactionPhoto}
          invalidSlotId={invalidSlotId}
        />
      </RegistrationFormCard>
    </>
  );
}
