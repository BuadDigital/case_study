"use client";

/**
 * «يوجد منقولات» photos — ONE control, one or more photos. New photos go into the multi-photo
 * `definedPhotos` slot `feature:movables`; the submit gate accepts any one of them. A photo saved
 * by the older single-proof picker (`featurePhotoAttachments.movables`) is still shown and
 * deletable, and counts for the gate too.
 */
import { useRef, useState } from "react";
import { cn, useToast } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  nextInspectorPhotoId,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import {
  MOVABLES_EXTRA_PHOTOS_SLOT_ID,
  definedSlotWithoutPhoto,
  definedSlotWithPhoto,
  emptyDefinedPhotoSlot,
  setDefinedPhotoSlot,
  slotPhotoRef,
} from "./inspector-wizard-state";

export function InspectorMovablesPhotosField({
  draft,
  disabled,
  invalid,
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  /** Highlight after a failed save that asked for the photo. */
  invalid?: boolean;
  onPatch: (
    patch: Partial<Pick<InspectorWorkspaceDraft, "definedPhotos" | "featurePhotoAttachments">>,
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const photos = draft.definedPhotos[MOVABLES_EXTRA_PHOTOS_SLOT_ID]?.photos ?? [];
  const legacyProof = draft.featurePhotoAttachments.movables?.fileName
    ? draft.featurePhotoAttachments.movables
    : null;
  const hasAny = photos.length > 0 || Boolean(legacyProof);
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: Boolean(disabled) || uploading,
    onFiles: (files) => runWithUploadToast(() => addFiles(files)),
  });

  async function addFiles(files: File[]) {
    if (disabled || uploading || files.length === 0) return;
    setUploading(true);
    try {
      let workingDraft = draft;
      for (const file of files) {
        const nextId = nextInspectorPhotoId(workingDraft);
        const ref = slotPhotoRef(MOVABLES_EXTRA_PHOTOS_SLOT_ID, nextId);
        const result = await uploadInspectorPhotoFromFile(draft.taskId, ref, file, {
          draft: workingDraft,
        });
        if (!result.ok) throw new Error(result.error);
        const slot =
          workingDraft.definedPhotos[MOVABLES_EXTRA_PHOTOS_SLOT_ID] ?? emptyDefinedPhotoSlot();
        workingDraft = {
          ...workingDraft,
          definedPhotos: setDefinedPhotoSlot(
            workingDraft.definedPhotos,
            MOVABLES_EXTRA_PHOTOS_SLOT_ID,
            definedSlotWithPhoto(slot, { id: nextId, approved: true, ...result.attachment }),
          ),
        };
      }
      onPatch({ definedPhotos: workingDraft.definedPhotos });
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(photoId: number) {
    clearInspectorPhotoDataUrl(
      draft.taskId,
      slotPhotoRef(MOVABLES_EXTRA_PHOTOS_SLOT_ID, photoId),
    );
    const slot = draft.definedPhotos[MOVABLES_EXTRA_PHOTOS_SLOT_ID] ?? emptyDefinedPhotoSlot();
    onPatch({
      definedPhotos: setDefinedPhotoSlot(
        draft.definedPhotos,
        MOVABLES_EXTRA_PHOTOS_SLOT_ID,
        definedSlotWithoutPhoto(slot, photoId),
      ),
    });
  }

  function removeLegacyProof() {
    clearInspectorPhotoDataUrl(draft.taskId, "feature:movables");
    onPatch({ featurePhotoAttachments: { ...draft.featurePhotoAttachments, movables: null } });
  }

  if (disabled && !hasAny) {
    return <span className="text-[11px] text-text-3">لا توجد صور للمنقولات</span>;
  }

  return (
    <div
      id="ins-feature-photo-movables"
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md",
        invalid && cn(invalidControlClass, "bg-danger-bg p-1"),
        dragOver && "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] ring-2 ring-primary/30",
      )}
      {...dropZoneProps}
    >
      {legacyProof ? (
        <InspectorStampedPhotoThumb
          compact
          stamp=""
          taskId={draft.taskId}
          photoRef="feature:movables"
          attachment={legacyProof}
          onClear={disabled ? undefined : removeLegacyProof}
        />
      ) : null}
      {photos.map((photo) => (
        <InspectorStampedPhotoThumb
          key={photo.id}
          compact
          stamp=""
          taskId={draft.taskId}
          photoRef={slotPhotoRef(MOVABLES_EXTRA_PHOTOS_SLOT_ID, photo.id)}
          attachment={photo}
          onClear={disabled ? undefined : () => removePhoto(photo.id)}
        />
      ))}
      {!disabled ? (
        <button
          type="button"
          disabled={uploading}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-1.5",
            "font-inherit text-[10.5px] font-semibold text-text-2 hover:border-primary hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            dragOver && "border-primary text-primary",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-upload text-[13px]" aria-hidden />
          {dragOver
            ? "أفلِت الصور هنا"
            : hasAny
              ? "إضافة صورة أخرى"
              : "إرفاق صورة (واحدة أو أكثر) أو اسحبها"}
        </button>
      ) : null}
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
          if (files.length > 0) void runWithUploadToast(() => addFiles(files));
        }}
      />
    </div>
  );
}
