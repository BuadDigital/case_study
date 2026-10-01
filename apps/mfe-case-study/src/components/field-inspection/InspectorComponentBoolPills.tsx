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

/** Read-view stand-in for a «on» pill — a check chip, not a toggle. */
export function InspectorPresentChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg px-[11px] py-[5px] text-[11.5px] font-semibold text-heading">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
    </span>
  );
}

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
      {slots
        // Read view lists what the property has; absent items are noise.
        .filter((slot) => editable || slot.on)
        .map((slot) => {
        const photoMissing = missingFeaturePhotoKey === slot.key;
        return (
          <div
            key={slot.key}
            id={`ins-feature-${slot.key}`}
            className="flex flex-wrap items-center gap-2"
          >
            {editable ? (
              <button
                type="button"
                className={inspectorBoolPillClass(slot.on)}
                onClick={() => toggle(slot.key, slot.on)}
              >
                {slot.label}
              </button>
            ) : (
              <InspectorPresentChip label={slot.label} />
            )}
            {slot.needsPhoto ? (
              <span
                id={`ins-feature-photo-${slot.key}`}
                className={cn(
                  "flex justify-center",
                  photoMissing && "rounded-md bg-danger-bg p-1",
                )}
              >
                <EditableFeaturePhotoCell
                  needsPhoto
                  hasPhoto={slot.hasPhoto}
                  disabled={!editable}
                  taskId={draft.taskId}
                  photoRef={`feature:${slot.key}`}
                  attachment={draft.featurePhotoAttachments[slot.key]}
                  onClear={
                    !editable
                      ? undefined
                      : () => {
                          clearInspectorPhotoDataUrl(
                            draft.taskId,
                            `feature:${slot.key}`,
                          );
                          onPatch({
                            featurePhotoAttachments: {
                              ...draft.featurePhotoAttachments,
                              [slot.key]: null,
                            },
                          });
                        }
                  }
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
