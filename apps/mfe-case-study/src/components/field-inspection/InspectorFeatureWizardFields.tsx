"use client";

/**
 * Field Inspection Workspace design — step-2 feature fields as selects / chips / toggles
 * (replaces the dense photo table while editing in wizard mode).
 */

import { cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  inspectorFeatureOffersPhoto,
  patchInspectorFeatureValues,
  type InspectorFeatureField,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { clearInspectorPhotoDataUrl, uploadInspectorPhotoFromFile } from "../../lib/app-data/inspector-photo-upload";
import { EditableFeaturePhotoCell, InsReadField } from "../po-intake/PropertyDetailInspectionParts";
import { InspectorMovablesDescriptionField } from "./InspectorMovablesDescriptionField";
import { InspectorMovablesPhotosField } from "./InspectorMovablesPhotosField";
import { movablesPhotosResetPatch } from "./inspector-wizard-state";
import { InspectorOccupancyDescriptionField } from "./InspectorOccupancyDescriptionField";
import { EDIT_CONTROL_CLASS, INS_LABEL_CLASS } from "./FieldInspectionWorkParts";
import {
  MOVABLES_DESCRIPTION_KEY,
  OCCUPANCY_STATE_KEY,
  OCCUPANCY_DESCRIPTION_KEY,
} from "../../lib/app-data/inspector-workspace-data";
import { featurePhotoPatch } from "../../lib/app-data/inspector-workspace-model";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";

const INS_LABEL_CENTERED_CLASS = cn(INS_LABEL_CLASS, "w-full text-center");
const INS_GRID_SELECT_CLASS = cn(EDIT_CONTROL_CLASS, "text-center");
const INS_GRID_NUMERIC_CLASS = cn(
  EDIT_CONTROL_CLASS,
  "text-center tabular-nums [direction:ltr] [unicode-bidi:isolate]",
);

function chipStyle(on: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-[11px] py-[5px] font-inherit text-[11.5px] cursor-pointer",
    on
      ? "border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg text-heading"
      : "border-border bg-surface-2 text-text-3",
  );
}

function boolPillStyle(on: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] font-inherit text-xs font-semibold cursor-pointer",
    on
      ? "border-ink bg-ink text-white"
      : "border-border-md bg-surface text-text-2",
  );
}

export function InspectorFeatureWizardFields({
  fields,
  draft,
  deedNumber,
  emptyFeatureKeys,
  missingFeaturePhotoKey,
  movablesDescriptionError,
  occupancyDescriptionError,
  hidePhotos = false,
  disabled = false,
  readOnlyFeatureKeys = [],
  sourceNotes = {},
  onPatch,
}: {
  fields: InspectorFeatureField[];
  draft: InspectorWorkspaceDraft;
  deedNumber?: string;
  emptyFeatureKeys?: string[];
  missingFeaturePhotoKey?: string;
  movablesDescriptionError?: string;
  occupancyDescriptionError?: string;
  /** Field Inspection Workspace design — no per-feature photo column. */
  hidePhotos?: boolean;
  disabled?: boolean;
  /** Fields owned by another role and therefore visible but immutable here. */
  readOnlyFeatureKeys?: readonly string[];
  /** Where a still-untouched pre-answered value came from (feature key → «المصدر: …»). */
  sourceNotes?: Record<string, string>;
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
}) {
  const readOnlyKeys = new Set(readOnlyFeatureKeys);
  const selectFields = fields.filter(
    (f) => f.options.length > 3 && !f.options.includes("نعم"),
  );
  const choiceFields = fields.filter(
    (f) => f.key !== "movables" && f.options.length <= 3,
  );
  /** Design: only «يوجد منقولات» lives as a pill in this card. */
  const boolFields = fields.filter(
    (f) => f.options.includes("نعم") && f.key === "movables",
  );

  function setFeature(key: string, next: string) {
    if (disabled || readOnlyKeys.has(key)) return;
    const photoRef = `feature:${key}`;
    onPatch({
      ...movablesPhotosResetPatch(draft, key, next),
      featureValues: patchInspectorFeatureValues(draft.featureValues, key, next),
      featurePhotoAttachments: {
        ...draft.featurePhotoAttachments,
        [key]: inspectorFeatureOffersPhoto(
          fields.find((f) => f.key === key)!,
          next,
        )
          ? draft.featurePhotoAttachments[key]
          : null,
      },
    });
    if (
      !inspectorFeatureOffersPhoto(
        fields.find((f) => f.key === key)!,
        next,
      )
    ) {
      clearInspectorPhotoDataUrl(draft.taskId, photoRef);
    }
  }

  /** Read-only / value / missing flags shared by the select and chip fields. */
  function featureFieldState(field: InspectorFeatureField) {
    const rawVal = draft.featureValues[field.key]?.trim() ?? "";
    return {
      fieldDisabled: disabled || readOnlyKeys.has(field.key),
      rawVal,
      valueMissing: Boolean(emptyFeatureKeys?.includes(field.key)),
      needsPhoto: inspectorFeatureOffersPhoto(field, rawVal),
      photoMissing: missingFeaturePhotoKey === field.key,
    };
  }

  /** Stamped photo cell beside a feature whose answer asks for a photo. */
  function featurePhotoCell(key: string, fieldDisabled: boolean) {
    const photoRef = `feature:${key}`;
    return (
      <EditableFeaturePhotoCell
        needsPhoto
        hasPhoto={Boolean(draft.featurePhotoAttachments[key]?.fileName)}
        disabled={fieldDisabled}
        taskId={draft.taskId}
        photoRef={photoRef}
        attachment={draft.featurePhotoAttachments[key]}
        onClear={
          fieldDisabled
            ? undefined
            : () => {
                clearInspectorPhotoDataUrl(draft.taskId, photoRef);
                onPatch(featurePhotoPatch(key, null));
              }
        }
        onUpload={async (file) => {
          const result = await uploadInspectorPhotoFromFile(
            draft.taskId,
            photoRef,
            file,
            { draft, deedNumber },
          );
          if (!result.ok) throw new Error(result.error);
          onPatch(featurePhotoPatch(key, result.attachment));
          return true;
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {selectFields.map((field) => {
          const { fieldDisabled, rawVal, valueMissing, needsPhoto, photoMissing } =
            featureFieldState(field);
          return (
            <div key={field.key} id={`ins-feature-${field.key}`}>
              {fieldDisabled ? (
                <InsReadField label={field.label} value={rawVal} />
              ) : (
                <>
                  <span className={INS_LABEL_CENTERED_CLASS}>
                    {field.label}
                  </span>
                  <select
                    id={`ins-feature-select-${field.key}`}
                    aria-invalid={valueMissing || undefined}
                    className={cn(
                      INS_GRID_SELECT_CLASS,
                      (valueMissing || photoMissing) && invalidControlClass,
                    )}
                    value={rawVal}
                    onChange={(e) => setFeature(field.key, e.target.value)}
                  >
                    <option value="">— اختر —</option>
                    {/* A value saved under an older option list stays selectable. */}
                    {rawVal && !field.options.includes(rawVal) ? (
                      <option value={rawVal}>{rawVal}</option>
                    ) : null}
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {sourceNotes[field.key] ? (
                <span className="mt-1 block text-center text-[10.5px] text-text-3">
                  {sourceNotes[field.key]}
                </span>
              ) : null}
              {!hidePhotos && needsPhoto ? (
                <div
                  id={`ins-feature-photo-${field.key}`}
                  className={cn(
                    "mt-1.5 flex justify-center",
                    photoMissing && "rounded-md bg-danger-bg p-1",
                  )}
                >
                  {featurePhotoCell(field.key, fieldDisabled)}
                </div>
              ) : null}
            </div>
          );
        })}
        <div>
          {disabled ? (
            <InsReadField label="عمر العقار (سنوات)" value={draft.propertyAgeYears} ltr />
          ) : (
            <>
              <span className={INS_LABEL_CENTERED_CLASS}>
                عمر العقار (سنوات)
              </span>
              <input
                className={INS_GRID_NUMERIC_CLASS}
                inputMode="numeric"
                value={draft.propertyAgeYears}
                onChange={(e) => onPatch({ propertyAgeYears: e.target.value })}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {choiceFields.map((field) => {
          const { fieldDisabled, rawVal, valueMissing, needsPhoto, photoMissing } =
            featureFieldState(field);
          return (
            <div
              key={field.key}
              id={`ins-feature-${field.key}`}
              className={cn(valueMissing && invalidControlClass, valueMissing && "rounded-md p-1")}
            >
              {fieldDisabled ? (
                <InsReadField label={field.label} value={rawVal} />
              ) : (
                <>
                  <span className={INS_LABEL_CENTERED_CLASS}>
                    {field.label}
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {field.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={chipStyle(rawVal === opt)}
                        onClick={() => setFeature(field.key, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!hidePhotos && needsPhoto ? (
                <div
                  id={`ins-feature-photo-${field.key}`}
                  className={cn(
                    "mt-1.5 flex justify-center",
                    photoMissing && "rounded-md bg-danger-bg p-1",
                  )}
                >
                  {featurePhotoCell(field.key, fieldDisabled)}
                </div>
              ) : null}
              {field.key === OCCUPANCY_STATE_KEY && rawVal === "مشغول" ? (
                <InspectorOccupancyDescriptionField
                  value={draft.featureValues[OCCUPANCY_DESCRIPTION_KEY] ?? ""}
                  disabled={disabled}
                  invalid={Boolean(occupancyDescriptionError)}
                  onChange={(v) =>
                    onPatch({
                      featureValues: {
                        ...draft.featureValues,
                        [OCCUPANCY_DESCRIPTION_KEY]: v,
                      },
                    })
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {boolFields.length > 0 ? (
        <div className="border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {boolFields.map((field) => {
              const fieldDisabled = disabled || readOnlyKeys.has(field.key);
              const on = (draft.featureValues[field.key] ?? "") === "نعم";
              const needsPhoto = inspectorFeatureOffersPhoto(field, on ? "نعم" : "لا");
              const photoMissing = missingFeaturePhotoKey === field.key;
              return (
                <div
                  key={field.key}
                  id={`ins-feature-${field.key}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  {fieldDisabled ? (
                    <InsReadField label={field.label} value={on ? "نعم" : "لا"} className="min-w-[150px]" />
                  ) : (
                    <button
                      type="button"
                      className={boolPillStyle(on)}
                      onClick={() => setFeature(field.key, on ? "لا" : "نعم")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3"
                        aria-hidden
                      >
                        <path d={on ? "M20 6 9 17l-5-5" : "M12 5v14M5 12h14"} />
                      </svg>
                      {field.label}
                    </button>
                  )}
                  {!hidePhotos && needsPhoto && field.key !== "movables" ? (
                    <span
                      id={`ins-feature-photo-${field.key}`}
                      className={cn(
                        "mt-1.5 flex justify-center",
                        photoMissing && "rounded-md bg-danger-bg p-1",
                        photoMissing && invalidControlClass,
                      )}
                    >
                      {featurePhotoCell(field.key, fieldDisabled)}
                    </span>
                  ) : null}
                  {field.key === "movables" && on ? (
                    <div className="flex w-full flex-col gap-2">
                      <InspectorMovablesDescriptionField
                        value={draft.featureValues[MOVABLES_DESCRIPTION_KEY] ?? ""}
                        disabled={disabled}
                        invalid={Boolean(movablesDescriptionError)}
                        onChange={(v) =>
                          onPatch({
                            featureValues: {
                              ...draft.featureValues,
                              [MOVABLES_DESCRIPTION_KEY]: v,
                            },
                          })
                        }
                      />
                      {!hidePhotos ? (
                        <InspectorMovablesPhotosField
                          draft={draft}
                          disabled={disabled}
                          invalid={photoMissing}
                          onPatch={onPatch}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
