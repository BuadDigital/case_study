"use client";

/**
 * Bare section — always nested inside a parent card (InspectorCard / InsCard),
 * so it renders no outer chrome of its own. Owns the slot mutations (upload,
 * delete, «غير متوفر», pick from the transaction) and the approve/delete
 * preview modal; the grid itself is `InspectorDefinedPhotoSlotList` and the
 * pure slot rules live in `inspector-wizard-state`.
 */
import { useEffect, useMemo, useState } from "react";
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
  useToast,
} from "@platform/ui-kit";
import {
  inspectorPhotoStampText,
  nextInspectorPhotoId,
  type InspectorDefinedPhotoSlot,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  inspectorPhotoAttachmentFromTransactionDoc,
  openInspectorPhotoPreview,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import { InspectorDefinedPhotoSlotList } from "./InspectorDefinedPhotoSlotList";
import {
  definedPhotosIntroText,
  definedSlotNone,
  definedSlotReplacedBy,
  definedSlotWithApproved,
  definedSlotWithoutPhoto,
  definedSlotWithPhoto,
  emptyDefinedPhotoSlot,
  findDefinedSlotPhoto,
  listDefinedPhotoSlotCells,
  setDefinedPhotoSlot,
  slotPhotoRef,
} from "./inspector-wizard-state";

export { freePhotoRef } from "./inspector-wizard-state";

type Patch = Partial<Pick<InspectorWorkspaceDraft, "definedPhotos">>;
type PreviewRef = { kind: "slot"; slotId: string; photoId: number };

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

  const cells = useMemo(
    () => listDefinedPhotoSlotCells(draft),
    [draft.services, draft.amenities, draft.definedPhotos],
  );

  const canPickFromTransaction = Boolean(
    transactionPhotos && transactionPhotos.length > 0,
  );

  const previewPhoto = useMemo(() => {
    if (!previewRef) return null;
    return findDefinedSlotPhoto(draft.definedPhotos, previewRef.slotId, previewRef.photoId);
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

  function deleteSlotPhoto(slotId: string, photoId: number) {
    clearInspectorPhotoDataUrl(draft.taskId, slotPhotoRef(slotId, photoId));
    patchDefinedPhotos(slotId, (slot) => definedSlotWithoutPhoto(slot, photoId));
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

  function approvePreviewPhoto() {
    if (!previewRef || !previewPhoto) return;
    patchDefinedPhotos(previewRef.slotId, (slot) =>
      definedSlotWithApproved(slot, previewRef.photoId),
    );
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
        <p
          className={
            layout === "desktop"
              ? "mb-3 text-[11px] leading-relaxed text-text-3"
              : "mb-2.5 text-[11px] leading-relaxed text-text-3"
          }
        >
          {definedPhotosIntroText(layout, canPickFromTransaction)}
        </p>

        <InspectorDefinedPhotoSlotList
          cells={cells}
          layout={layout}
          taskId={draft.taskId}
          disabled={Boolean(disabled || uploading)}
          transactionPhotos={canPickFromTransaction ? transactionPhotos : undefined}
          onUpload={uploadSlotPhotos}
          onToggleNone={toggleSlotNone}
          onOpen={(slotId, photoId) => setPreviewRef({ kind: "slot", slotId, photoId })}
          onSelectTransactionPhoto={selectTransactionPhoto}
        />
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
