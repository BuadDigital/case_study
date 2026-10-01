"use client";

/**
 * «وصف العقار» alternative: a photo of the components' details. The inspector must
 * give a written description or this photo (at least one) — see
 * `inspectorDescriptionMissing` and `FieldInspectionSubmissionValidator`.
 */

import { cn } from "@platform/ui-kit";
import {
  PROPERTY_DESCRIPTION_PHOTO_KEY,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { EditableFeaturePhotoCell } from "../po-intake/PropertyDetailInspectionParts";

const PHOTO_REF = `feature:${PROPERTY_DESCRIPTION_PHOTO_KEY}`;

export function InspectorDescriptionPhoto({
  deedNumber,
  draft,
  editable,
  invalid,
  onPatch,
}: {
  deedNumber: string;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  invalid?: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const attachment = draft.featurePhotoAttachments[PROPERTY_DESCRIPTION_PHOTO_KEY] ?? null;
  if (!editable && !attachment?.attachmentId) return null;
  return (
    <div
      id="ins-desc-photo"
      className={cn(
        "mt-2 flex flex-wrap items-center gap-2",
        invalid && "rounded-md bg-danger-bg p-1",
      )}
    >
      <span className="text-[11px] font-semibold text-text-2">
        {editable ? "أو صورة لتفاصيل المكونات" : "صورة تفاصيل المكونات"}
      </span>
      <EditableFeaturePhotoCell
        needsPhoto
        hasPhoto={Boolean(attachment?.attachmentId)}
        disabled={!editable}
        taskId={draft.taskId}
        photoRef={PHOTO_REF}
        attachment={attachment}
        onClear={
          !editable
            ? undefined
            : () => {
                clearInspectorPhotoDataUrl(draft.taskId, PHOTO_REF);
                onPatch({
                  featurePhotoAttachments: {
                    ...draft.featurePhotoAttachments,
                    [PROPERTY_DESCRIPTION_PHOTO_KEY]: null,
                  },
                });
              }
        }
        onUpload={async (file) => {
          const result = await uploadInspectorPhotoFromFile(draft.taskId, PHOTO_REF, file, {
            draft,
            deedNumber,
          });
          if (!result.ok) throw new Error(result.error);
          onPatch({
            featurePhotoAttachments: {
              ...draft.featurePhotoAttachments,
              [PROPERTY_DESCRIPTION_PHOTO_KEY]: result.attachment,
            },
          });
          return true;
        }}
      />
    </div>
  );
}
