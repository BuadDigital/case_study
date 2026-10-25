"use client";

import type { InspectorPhotoAttachment } from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";

/**
 * One inspector photo slot: the stamped thumb once a photo is attached (clearable unless
 * disabled), otherwise the file picker that uploads and stamps it.
 */
export function InspectorPhotoThumbOrPicker({
  taskId,
  photoRef,
  attachment,
  stamp,
  compact,
  disabled,
  pickerLabel,
  pickerClassName,
  uploadContext,
  onAttachmentChange,
}: {
  taskId: string;
  photoRef: string;
  attachment: InspectorPhotoAttachment | null | undefined;
  stamp: string;
  compact?: boolean;
  disabled?: boolean;
  pickerLabel: string;
  pickerClassName?: string;
  /** Draft + deed the upload stamps onto the photo. */
  uploadContext: Parameters<typeof uploadInspectorPhotoFromFile>[3];
  /** Patch the draft with the new attachment (`null` after clearing). */
  onAttachmentChange: (attachment: InspectorPhotoAttachment | null) => void;
}) {
  if (attachment?.fileName) {
    return (
      <InspectorStampedPhotoThumb
        compact={compact}
        stamp={stamp}
        taskId={taskId}
        photoRef={photoRef}
        attachment={attachment}
        onClear={
          disabled
            ? undefined
            : () => {
                clearInspectorPhotoDataUrl(taskId, photoRef);
                onAttachmentChange(null);
              }
        }
      />
    );
  }
  return (
    <InspectorPhotoFilePicker
      label={pickerLabel}
      disabled={disabled}
      className={pickerClassName}
      onFilesSelected={async (files) => {
        const file = files[0];
        if (!file) return false;
        const result = await uploadInspectorPhotoFromFile(
          taskId,
          photoRef,
          file,
          uploadContext,
        );
        if (!result.ok) {
          throw new Error(result.error);
        }
        onAttachmentChange(result.attachment);
        return true;
      }}
    />
  );
}
