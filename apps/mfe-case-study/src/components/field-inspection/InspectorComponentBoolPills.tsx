"use client";

/**
 * Yes/no component pills of the wizard's «مكوّنات العقار» card. A pill on
 * «نعم» shows the same photo picker as the feature fields, so the proof-photo
 * rule (2026-09-01, «يجب إرفاق صورة توثيقية») can be met from this step.
 */

import { cn } from "@platform/ui-kit";
import {
  patchInspectorFeatureValues,
  visibleInspectorFeatureFields,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { EditableFeaturePhotoCell } from "../po-intake/PropertyDetailInspectionParts";
import {
  inspectorBoolPillClass,
  listComponentBoolPhotoSlots,
} from "./inspector-wizard-state";

export function InspectorComponentBoolPills({
  deedNumber,
  draft,
  editable,
  isLand,
  missingFeaturePhotoKey,
  onPatch,
}: {
  deedNumber: string;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  isLand: boolean;
  missingFeaturePhotoKey?: string;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const slots = listComponentBoolPhotoSlots(
    draft,
    visibleInspectorFeatureFields(false),
    isLand,
  );

  function toggle(key: string, on: boolean) {
    if (!editable) return;
    const next = on ? "لا" : "نعم";
    const patch: Partial<InspectorWorkspaceDraft> = {
      featureValues: patchInspectorFeatureValues(draft.featureValues, key, next),
    };
    if (on) {
      // «لا» drops the proof photo the way the feature fields do.
      clearInspectorPhotoDataUrl(draft.taskId, `feature:${key}`);
      patch.featurePhotoAttachments = {
        ...draft.featurePhotoAttachments,
        [key]: null,
      };
    }
    onPatch(patch);
  }

  return (
    <>
      {slots.map((slot) => {
        const photoMissing = missingFeaturePhotoKey === slot.key;
        return (
          <div
            key={slot.key}
            id={`ins-feature-${slot.key}`}
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              disabled={!editable}
              className={inspectorBoolPillClass(slot.on, !editable)}
              onClick={() => toggle(slot.key, slot.on)}
            >
              {slot.label}
            </button>
            {slot.needsPhoto ? (
              <span
                id={`ins-feature-photo-${slot.key}`}
                className={cn(photoMissing && "rounded-md bg-danger-bg p-1")}
              >
                <EditableFeaturePhotoCell
                  needsPhoto
                  hasPhoto={slot.hasPhoto}
                  disabled={!editable}
                  onUpload={async (file) => {
                    const result = await uploadInspectorPhotoFromFile(
                      draft.taskId,
                      `feature:${slot.key}`,
                      file,
                      { draft, deedNumber },
                    );
                    if (!result.ok) throw new Error(result.error);
                    onPatch({
                      featurePhotoAttachments: {
                        ...draft.featurePhotoAttachments,
                        [slot.key]: result.attachment,
                      },
                    });
                    return true;
                  }}
                />
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
