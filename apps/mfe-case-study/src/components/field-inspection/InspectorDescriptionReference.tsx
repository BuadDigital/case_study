"use client";

/** Read-only view of what the inspector sent for «وصف العقار» — text and/or a photographed sheet. */
import {
  PROPERTY_DESCRIPTION_PHOTO_KEY,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InspectorDescriptionPhoto } from "./InspectorDescriptionPhoto";

export function InspectorDescriptionReference({
  draft,
  deedNumber,
}: {
  draft: InspectorWorkspaceDraft;
  deedNumber: string;
}) {
  const text = draft.propertyDescription.trim();
  const hasPhoto = Boolean(
    draft.featurePhotoAttachments[PROPERTY_DESCRIPTION_PHOTO_KEY]?.attachmentId,
  );
  return (
    <div className="space-y-2">
      <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-text">
        {text || "لم يكتب المعاين نصاً."}
      </p>
      {hasPhoto ? (
        <InspectorDescriptionPhoto
          deedNumber={deedNumber}
          draft={draft}
          editable={false}
          onPatch={() => {}}
        />
      ) : null}
    </div>
  );
}
