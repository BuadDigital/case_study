"use client";

/** Inspection-tab photo parts — slot tile, feature-table picker cell, count-with-photo field. */

import { useEffect, useRef, useState } from "react";
import { cn, useToast } from "@platform/ui-kit";
import type { InspectorWorkspacePatch } from "../../lib/app-data/inspector-workspace-model";
import type {
  InspectorComponentPhotoKey,
  InspectorPhotoAttachment,
  InspectorSlotPhoto,
  InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import { InspectorPhotoFilePicker } from "../field-inspection/InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "../field-inspection/InspectorStampedPhotoThumb";
import { InsEditField, InsField } from "./PropertyDetailInspectionFields";
import {
  componentCountPatch,
  componentNeedsPhoto,
  componentPhotoAttachmentPatch,
  componentPhotoNoun,
  componentPhotoRef,
  photoTileEmptyLabel,
  photoTileFlagBadge,
} from "./property-detail-inspection-state";

export function PhotoTile({
  label,
  filled,
  none,
  taskId,
  photoRef,
  photo,
  locationFlag,
  distanceM,
}: {
  label: string;
  filled: boolean;
  none?: boolean;
  taskId?: string;
  photoRef?: string;
  photo?: InspectorSlotPhoto | null;
  locationFlag?: string | null;
  distanceM?: number | null;
}) {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() =>
    taskId && photoRef ? getInspectorPhotoDataUrl(taskId, photoRef) : undefined,
  );

  useEffect(() => {
    if (!filled || !taskId || !photoRef || !photo) {
      setDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, photo)
      .then((url) => {
        if (!cancelled && url) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [filled, taskId, photoRef, photo]);

  const flag = photoTileFlagBadge(locationFlag, distanceM);

  return (
    <div
      className={cn(
        "relative grid h-[100px] place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 bg-cover bg-center",
        none && "border-dashed",
      )}
      style={dataUrl && filled ? { backgroundImage: `url(${dataUrl})` } : undefined}
      title={label}
    >
      {filled && !dataUrl ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-3, #8a8d96)"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 5-5 4 4 3-2 4 4" />
        </svg>
      ) : null}
      {!filled ? (
        <span className="text-[10.5px] text-[#d9694f]">
          {photoTileEmptyLabel(none)}
        </span>
      ) : null}
      {flag ? (
        <span
          className={`absolute inset-x-1 top-1 z-[1] rounded px-1 py-0.5 text-center text-[9px] font-semibold text-white ${flag.tone}`}
          title={flag.title}
        >
          {flag.text}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 bg-[rgba(16,43,78,0.72)] px-1.5 py-[3px] text-center text-[9.5px] text-white">
        {label}
      </span>
    </div>
  );
}

/** Desktop file-picker cell for feature-table «photo» (PC friendly). */
export function EditableFeaturePhotoCell({
  needsPhoto,
  hasPhoto,
  disabled,
  onUpload,
}: {
  needsPhoto: boolean;
  hasPhoto: boolean;
  disabled?: boolean;
  onUpload: (file: File) => boolean | void | Promise<boolean | void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled,
    onFiles: (files) => {
      const file = files[0];
      if (file) void runWithUploadToast(() => onUpload(file));
    },
  });

  if (!needsPhoto) {
    return <span className="text-text-3">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center gap-1 rounded-md px-1 py-0.5",
        dragOver &&
          "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] ring-2 ring-primary/30",
      )}
      {...dropZoneProps}
    >
      {hasPhoto ? (
        <button
          type="button"
          disabled={disabled}
          title="استبدال — اسحب صورة جديدة أو اختر من الجهاز"
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inherit text-[10.5px] text-[#1f6f6f] hover:underline disabled:cursor-default"
          onClick={() => inputRef.current?.click()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {dragOver ? "أفلِت هنا" : "مرفقة"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-1.5",
            "font-inherit text-[10.5px] font-semibold text-text-2 hover:border-primary hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            dragOver && "border-primary text-primary",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-upload text-[13px]" aria-hidden />
          {dragOver ? "أفلِت الصورة" : "إرفاق صورة"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = filterInspectorPhotoFiles(e.target.files)[0];
          e.target.value = "";
          if (file) void runWithUploadToast(() => onUpload(file));
        }}
      />
    </span>
  );
}

/** Count field that requires a documentary photo when count > 0 (showroom / well). */
export function ComponentCountWithPhotoField({
  label,
  countValue,
  photoKey,
  photoLabel,
  attachment,
  taskId,
  stamp,
  deedNumber,
  draft,
  editMode,
  disabled,
  onPatch,
}: {
  label: string;
  countValue: string;
  photoKey: InspectorComponentPhotoKey;
  photoLabel: string;
  attachment: InspectorPhotoAttachment | null | undefined;
  taskId: string;
  stamp: string;
  deedNumber?: string | null;
  draft: InspectorWorkspaceDraft;
  editMode: boolean;
  disabled?: boolean;
  onPatch: (patch: InspectorWorkspacePatch) => void;
}) {
  const { showToast } = useToast();
  const photoRef = componentPhotoRef(photoKey);
  const needsPhoto = componentNeedsPhoto(countValue);

  if (!editMode) {
    return (
      <div className="min-w-0">
        <InsField label={label} value={countValue} ltr />
        {needsPhoto ? (
          <div className="mt-1.5 text-[11px] text-text-2">
            {attachment?.fileName ? (
              <span className="inline-flex items-center gap-1 text-[#1f6f6f]">
                <i className="ti ti-circle-check" aria-hidden />
                صورة {componentPhotoNoun(photoKey)} مرفقة
              </span>
            ) : (
              <span className="text-danger-text">صورة مطلوبة وغير مرفقة</span>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <InsEditField
        label={label}
        value={countValue}
        ltr
        type="number"
        onChange={(v) => {
          const { patch, clearsPhoto } = componentCountPatch(
            photoKey,
            v,
            draft.componentPhotoAttachments,
          );
          if (clearsPhoto) clearInspectorPhotoDataUrl(taskId, photoRef);
          onPatch(patch);
        }}
      />
      {needsPhoto ? (
        <div className="mt-1.5">
          {attachment?.fileName ? (
            <InspectorStampedPhotoThumb
              compact
              stamp={stamp}
              taskId={taskId}
              photoRef={photoRef}
              attachment={attachment}
              onClear={
                disabled
                  ? undefined
                  : () => {
                      clearInspectorPhotoDataUrl(taskId, photoRef);
                      onPatch(
                        componentPhotoAttachmentPatch(
                          photoKey,
                          draft.componentPhotoAttachments,
                          null,
                        ),
                      );
                    }
              }
            />
          ) : (
            <InspectorPhotoFilePicker
              label={photoLabel}
              disabled={disabled}
              className="w-auto"
              onFilesSelected={async (files) => {
                const file = files[0];
                if (!file) return false;
                const result = await uploadInspectorPhotoFromFile(
                  taskId,
                  photoRef,
                  file,
                  { draft, deedNumber },
                );
                if (!result.ok) {
                  throw new Error(result.error);
                }
                onPatch(
                  componentPhotoAttachmentPatch(
                    photoKey,
                    draft.componentPhotoAttachments,
                    result.attachment,
                  ),
                );
                return true;
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
