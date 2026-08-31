"use client";

/**
 * Field Inspection Workspace design — step-2 feature fields as selects / chips / toggles
 * (replaces the dense photo table while editing in wizard mode).
 */

import { cn } from "@platform/ui-kit";
import {
  inspectorFeatureRequiresPhoto,
  patchInspectorFeatureValues,
  type InspectorFeatureField,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { clearInspectorPhotoDataUrl, uploadInspectorPhotoFromFile } from "../../lib/prototype/inspector-photo-upload";
import { EditableFeaturePhotoCell } from "../po-intake/PropertyDetailInspectionParts";
import { InspectorMovablesDescriptionField } from "./InspectorMovablesDescriptionField";
import {
  EDIT_CONTROL_CLASS,
  INS_LABEL_CLASS,
} from "./FieldInspectionWorkParts";
import { MOVABLES_DESCRIPTION_KEY } from "../../lib/prototype/inspector-workspace-data";

function chipStyle(on: boolean, disabled = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-[11px] py-[5px] font-inherit text-[11.5px]",
    disabled ? "cursor-default" : "cursor-pointer",
    on
      ? "border-[color-mix(in_srgb,#1f6f6f_30%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
      : "border-border bg-surface-2 text-text-3",
  );
}

function boolPillStyle(on: boolean, disabled = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] font-inherit text-xs font-semibold",
    disabled ? "cursor-default" : "cursor-pointer",
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
  hidePhotos = false,
  disabled = false,
  onPatch,
}: {
  fields: InspectorFeatureField[];
  draft: InspectorWorkspaceDraft;
  deedNumber?: string;
  emptyFeatureKeys?: string[];
  missingFeaturePhotoKey?: string;
  /** Field Inspection Workspace design — no per-feature photo column. */
  hidePhotos?: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const selectFields = fields.filter(
    (f) => f.options.length > 3 && !f.options.includes("نعم"),
  );
  const choiceFields = fields.filter(
    (f) => f.options.length <= 3 && !f.options.includes("نعم"),
  );
  /** Design: only «يوجد منقولات» lives in the features card; other yes/no are under components. */
  const boolFields = fields.filter(
    (f) => f.options.includes("نعم") && f.key === "movables",
  );

  function setFeature(key: string, next: string) {
    if (disabled) return;
    const photoRef = `feature:${key}`;
    onPatch({
      featureValues: patchInspectorFeatureValues(draft.featureValues, key, next),
      featurePhotoAttachments: {
        ...draft.featurePhotoAttachments,
        [key]: inspectorFeatureRequiresPhoto(
          fields.find((f) => f.key === key)!,
          next,
        )
          ? draft.featurePhotoAttachments[key]
          : null,
      },
    });
    if (
      !inspectorFeatureRequiresPhoto(
        fields.find((f) => f.key === key)!,
        next,
      )
    ) {
      clearInspectorPhotoDataUrl(draft.taskId, photoRef);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {selectFields.map((field) => {
          const rawVal = draft.featureValues[field.key]?.trim() ?? "";
          const valueMissing = Boolean(emptyFeatureKeys?.includes(field.key));
          const needsPhoto = inspectorFeatureRequiresPhoto(field, rawVal);
          const hasPhoto = Boolean(draft.featurePhotoAttachments[field.key]?.fileName);
          const photoMissing = missingFeaturePhotoKey === field.key;
          return (
            <div key={field.key} id={`ins-feature-${field.key}`}>
              <span className={INS_LABEL_CLASS}>
                {field.label}
              </span>
              <select
                id={`ins-feature-select-${field.key}`}
                aria-invalid={valueMissing || undefined}
                disabled={disabled}
                className={cn(
                  EDIT_CONTROL_CLASS,
                  disabled && "cursor-default opacity-90",
                  (valueMissing || photoMissing) && "border-danger",
                )}
                value={rawVal}
                onChange={(e) => setFeature(field.key, e.target.value)}
              >
                <option value="">— اختر —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {!hidePhotos && needsPhoto ? (
                <div
                  id={`ins-feature-photo-${field.key}`}
                  className={cn("mt-1.5", photoMissing && "rounded-md bg-danger-bg p-1")}
                >
                  <EditableFeaturePhotoCell
                    needsPhoto
                    hasPhoto={hasPhoto}
                    onUpload={async (file) => {
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        `feature:${field.key}`,
                        file,
                        { draft, deedNumber },
                      );
                      if (!result.ok) throw new Error(result.error);
                      onPatch({
                        featurePhotoAttachments: {
                          ...draft.featurePhotoAttachments,
                          [field.key]: result.attachment,
                        },
                      });
                      return true;
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <div>
          <span className={INS_LABEL_CLASS}>
            عمر العقار (سنوات)
          </span>
          <input
            className={cn(
              EDIT_CONTROL_CLASS,
              "tabular-nums",
              disabled && "cursor-default opacity-90",
            )}
            dir="ltr"
            inputMode="numeric"
            disabled={disabled}
            value={draft.propertyAgeYears}
            onChange={(e) => {
              if (disabled) return;
              onPatch({ propertyAgeYears: e.target.value });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {choiceFields.map((field) => {
          const rawVal = draft.featureValues[field.key]?.trim() ?? "";
          const valueMissing = Boolean(emptyFeatureKeys?.includes(field.key));
          const needsPhoto = inspectorFeatureRequiresPhoto(field, rawVal);
          const hasPhoto = Boolean(draft.featurePhotoAttachments[field.key]?.fileName);
          const photoMissing = missingFeaturePhotoKey === field.key;
          return (
            <div key={field.key} id={`ins-feature-${field.key}`}>
              <span className={INS_LABEL_CLASS}>
                {field.label}
                {valueMissing ? (
                  <span className="ms-1.5 text-[10px] font-bold text-danger">مطلوب</span>
                ) : null}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {field.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    className={chipStyle(rawVal === opt, disabled)}
                    onClick={() => setFeature(field.key, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {!hidePhotos && needsPhoto ? (
                <div
                  id={`ins-feature-photo-${field.key}`}
                  className={cn("mt-1.5", photoMissing && "rounded-md bg-danger-bg p-1")}
                >
                  <EditableFeaturePhotoCell
                    needsPhoto
                    hasPhoto={hasPhoto}
                    onUpload={async (file) => {
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        `feature:${field.key}`,
                        file,
                        { draft, deedNumber },
                      );
                      if (!result.ok) throw new Error(result.error);
                      onPatch({
                        featurePhotoAttachments: {
                          ...draft.featurePhotoAttachments,
                          [field.key]: result.attachment,
                        },
                      });
                      return true;
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {boolFields.length > 0 ? (
        <div className="border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {boolFields.map((field) => {
              const on = (draft.featureValues[field.key] ?? "") === "نعم";
              const needsPhoto = inspectorFeatureRequiresPhoto(field, on ? "نعم" : "لا");
              const hasPhoto = Boolean(draft.featurePhotoAttachments[field.key]?.fileName);
              const photoMissing = missingFeaturePhotoKey === field.key;
              return (
                <div key={field.key} id={`ins-feature-${field.key}`} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    className={boolPillStyle(on, disabled)}
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
                  {!hidePhotos && needsPhoto ? (
                    <span
                      id={`ins-feature-photo-${field.key}`}
                      className={cn(photoMissing && "rounded-md bg-danger-bg p-1")}
                    >
                      <EditableFeaturePhotoCell
                        needsPhoto
                        hasPhoto={hasPhoto}
                        onUpload={async (file) => {
                          const result = await uploadInspectorPhotoFromFile(
                            draft.taskId,
                            `feature:${field.key}`,
                            file,
                            { draft, deedNumber },
                          );
                          if (!result.ok) throw new Error(result.error);
                          onPatch({
                            featurePhotoAttachments: {
                              ...draft.featurePhotoAttachments,
                              [field.key]: result.attachment,
                            },
                          });
                          return true;
                        }}
                      />
                    </span>
                  ) : null}
                  {field.key === "movables" && on ? (
                    <InspectorMovablesDescriptionField
                      value={draft.featureValues[MOVABLES_DESCRIPTION_KEY] ?? ""}
                      disabled={disabled}
                      onChange={(v) =>
                        onPatch({
                          featureValues: {
                            ...draft.featureValues,
                            [MOVABLES_DESCRIPTION_KEY]: v,
                          },
                        })
                      }
                    />
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
