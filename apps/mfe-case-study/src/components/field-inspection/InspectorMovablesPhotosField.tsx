"use client";

/**
 * Extra movables photos beyond the required proof shot (`featurePhotoAttachments.movables`,
 * unchanged and still gating submit) — stores into the same multi-photo `definedPhotos`
 * slot mechanism used for services/amenities, so any number of photos can be attached.
 */
import { useRef, useState } from "react";
import { cn, useToast } from "@platform/ui-kit";
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
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: Pick<InspectorWorkspaceDraft, "definedPhotos">) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const photos = draft.definedPhotos[MOVABLES_EXTRA_PHOTOS_SLOT_ID]?.photos ?? [];

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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
            "inline-flex items-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-2 py-1.5",
            "font-inherit text-[10.5px] font-semibold text-text-2 hover:border-primary hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-plus text-[12px]" aria-hidden />
          أضف صورة أخرى
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
