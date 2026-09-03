"use client";

/**
 * Step-2 card: the field verification form for property features.
 * Lifted out of `FieldInspectionWorkBody` as one self-contained section —
 * same markup, state stays with the parent.
 */
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import {
  MOVABLES_DESCRIPTION_KEY,
  OCCUPANCY_DESCRIPTION_KEY,
  OCCUPANCY_STATE_KEY,
  inspectorFeatureRequiresPhoto,
  isMovablesPresent,
  isOccupied,
  patchInspectorFeatureValues,
} from "../../lib/app-data/inspector-workspace-data";
import {
  inspectorInvalidControlClass,
} from "../../lib/app-data/inspector-workspace-validation";
import {
  DesktopFeaturePhotoCell,
  InsBadge,
  InspectorCard,
  MobileCountStepper,
} from "./FieldInspectionWorkParts";
import {
  MobileFieldLabel,
  MobilePills,
  MobileSearchSelect,
  MobileSuggestRow,
  featureUsesPills,
} from "./InspectMobileControls";
import {
  InspectorMovablesDescriptionField,
} from "./InspectorMovablesDescriptionField";
import {
  InspectorOccupancyDescriptionField,
} from "./InspectorOccupancyDescriptionField";
import {
  InspectorPhotoFilePicker,
} from "./InspectorPhotoFilePicker";
import {
  InspectorStampedPhotoThumb,
} from "./InspectorStampedPhotoThumb";
import {
  Select,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
  formControlClassName,
} from "@platform/ui-kit";
import {
  Fragment,
} from "react";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { RoleId } from "@platform/types";
import type { updateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import type { visibleInspectorFeatureFields } from "../../lib/app-data/inspector-workspace-data";

export function InspectorFeaturesSection({
  activeStep,
  cardLayout,
  draft,
  featureFields,
  fieldErrors,
  isLandInspection,
  layout,
  locked,
  mobile,
  persist,
  photoStamp,
  property,
  role,
}: {
  activeStep: number;
  cardLayout: "desktop" | "mobile";
  draft: InspectorWorkspaceDraft;
  featureFields: ReturnType<typeof visibleInspectorFeatureFields>;
  fieldErrors: InspectorWorkspaceFieldErrors;
  isLandInspection: boolean;
  layout: "desktop" | "mobile";
  locked: boolean;
  mobile: boolean;
  persist: (patch: Parameters<typeof updateInspectorWorkspace>[1]) => void;
  photoStamp: string;
  property: PoPropertyIntake | undefined;
  role: RoleId;
}) {
  const liveDraft = draft;
  return (
  <InspectorCard
    title={mobile ? "خصائص العقار" : "نموذج التحقق الميداني — خصائص العقار"}
    hidden={activeStep !== 2}
    icon="ti-list-check"
    layout={cardLayout}
    step={1}
    subtitle={mobile ? `${featureFields.length} خاصية` : undefined}
    defaultOpen={!mobile}
  >
    {fieldErrors.features || fieldErrors.featurePhotos ? (
      <p
        className="mb-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger"
        role="alert"
      >
        {fieldErrors.features ?? fieldErrors.featurePhotos}
      </p>
    ) : null}
    {/* Desktop: table */}
    <div className={cn(mobile && "hidden")} id="ins-features-section">
      <p className="mb-2 text-[11px] leading-relaxed text-text-3">
        عمود «صورة» لإثبات قيمة الحقل عند الحاجة (مثل «نعم» أو نوع الأصل).{" "}
        <strong className="font-semibold text-text-2">صور أنواع العقار</strong>{" "}
        (لكل خدمة/مرفق اخترته) تُرفع من قسم «توثيق الخدمات والمرافق» أدناه.
      </p>
      <Table className="min-w-[640px]">
        <THead>
          <Tr hoverable={false}>
            <Th className="w-8 text-center">#</Th>
            <Th className="text-right">الحقل</Th>
            <Th className="w-[180px] text-center">القيمة</Th>
            <Th className="w-[140px] text-center">صورة</Th>
          </Tr>
        </THead>
        <TBody>
          {featureFields.map((field, index) => {
            const value = draft.featureValues[field.key] ?? "";
            const attachment = draft.featurePhotoAttachments[field.key];
            const photoRef = `feature:${field.key}`;
            const valueMissing = Boolean(
              fieldErrors.emptyFeatureKeys?.includes(field.key),
            );
            const photoMissing =
              fieldErrors.missingFeaturePhotoKey === field.key;
            return (
              <Fragment key={field.key}>
              <Tr
                key={field.key}
                id={`ins-feature-${field.key}`}
                hoverable={false}
                className={cn(
                  (valueMissing || photoMissing) && "bg-danger-bg/45",
                )}
              >
                <Td className="text-center text-[11px] text-text-3">
                  {index + 1}
                </Td>
                <Td
                  className={cn(
                    (valueMissing || photoMissing) &&
                      "font-semibold text-danger",
                  )}
                >
                  {field.label}
                  {field.shared ? (
                    <InsBadge label="مشترك" tone="purple" />
                  ) : null}
                  {valueMissing ? (
                    <span className="ms-1.5 text-[10px] font-bold text-danger">
                      مطلوب
                    </span>
                  ) : null}
                  {photoMissing ? (
                    <span className="ms-1.5 text-[10px] font-bold text-danger">
                      صورة مطلوبة
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <Select
                    value={value}
                    aria-invalid={valueMissing || undefined}
                    onChange={(e) => {
                      const next = e.target.value;
                      persist({
                        featureValues: patchInspectorFeatureValues(
                          draft.featureValues,
                          field.key,
                          next,
                        ),
                        featurePhotoAttachments: {
                          ...draft.featurePhotoAttachments,
                          [field.key]:
                            inspectorFeatureRequiresPhoto(field, next)
                              ? draft.featurePhotoAttachments[field.key]
                              : null,
                        },
                      });
                      if (!inspectorFeatureRequiresPhoto(field, next)) {
                        clearInspectorPhotoDataUrl(draft.taskId, photoRef);
                      }
                    }}
                    className={cn(
                      formControlClassName,
                      "w-full appearance-none rounded-md border border-border-md bg-surface px-[9px] py-[5px] text-[12px] text-text font-inherit",
                      valueMissing && inspectorInvalidControlClass,
                    )}
                  >
                    <option value="">— اختر —</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td
                  id={`ins-feature-photo-${field.key}`}
                  className={cn(
                    "text-center text-text-3",
                    photoMissing && "bg-danger-bg",
                  )}
                >
                  <DesktopFeaturePhotoCell
                    needsPhoto={inspectorFeatureRequiresPhoto(field, value)}
                    hasPhoto={Boolean(attachment?.fileName)}
                    disabled={locked}
                    onUpload={async (file) => {
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        photoRef,
                        file,
                        {
                          draft: liveDraft,
                          deedNumber: property?.deedNumber,
                        },
                      );
                      if (!result.ok) {
                        throw new Error(result.error);
                      }
                      persist({
                        featurePhotoAttachments: {
                          ...draft.featurePhotoAttachments,
                          [field.key]: result.attachment,
                        },
                      });
                      return true;
                    }}
                  />
                </Td>
              </Tr>
              {field.key === "movables" && isMovablesPresent(draft.featureValues) ? (
                <Tr
                  hoverable={false}
                  className={cn(
                    fieldErrors.movablesDescription && "bg-danger-bg/45",
                  )}
                >
                  <Td />
                  <Td colSpan={3}>
                    <InspectorMovablesDescriptionField
                      value={
                        draft.featureValues[MOVABLES_DESCRIPTION_KEY] ?? ""
                      }
                      disabled={locked}
                      invalid={Boolean(fieldErrors.movablesDescription)}
                      onChange={(next) =>
                        persist({
                          featureValues: {
                            ...draft.featureValues,
                            [MOVABLES_DESCRIPTION_KEY]: next,
                          },
                        })
                      }
                    />
                  </Td>
                </Tr>
              ) : null}
              {field.key === OCCUPANCY_STATE_KEY && isOccupied(draft.featureValues) ? (
                <Tr
                  hoverable={false}
                  className={cn(
                    fieldErrors.occupancyDescription && "bg-danger-bg/45",
                  )}
                >
                  <Td />
                  <Td colSpan={3}>
                    <InspectorOccupancyDescriptionField
                      value={
                        draft.featureValues[OCCUPANCY_DESCRIPTION_KEY] ?? ""
                      }
                      disabled={locked}
                      invalid={Boolean(fieldErrors.occupancyDescription)}
                      onChange={(next) =>
                        persist({
                          featureValues: {
                            ...draft.featureValues,
                            [OCCUPANCY_DESCRIPTION_KEY]: next,
                          },
                        })
                      }
                    />
                  </Td>
                </Tr>
              ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </div>

    {/* Mobile: pills / suggest+search (HTML renderInspectMobile) */}
    <div className={cn("flex flex-col", !mobile && "hidden")}>
      {featureFields.map((field, fi) => {
        const value = draft.featureValues[field.key] ?? "";
        const attachment = draft.featurePhotoAttachments[field.key];
        const photoRef = `feature:${field.key}`;
        const needsPhoto = inspectorFeatureRequiresPhoto(field, value);
        const usePills = featureUsesPills(field);
        const valueMissing = Boolean(
          fieldErrors.emptyFeatureKeys?.includes(field.key),
        );
        const photoMissing =
          fieldErrors.missingFeaturePhotoKey === field.key;

        function setFeatureValue(next: string) {
          persist({
            featureValues: patchInspectorFeatureValues(
              liveDraft.featureValues,
              field.key,
              next,
            ),
            featurePhotoAttachments: {
              ...liveDraft.featurePhotoAttachments,
              [field.key]: inspectorFeatureRequiresPhoto(field, next)
                ? liveDraft.featurePhotoAttachments[field.key]
                : null,
            },
          });
          if (!inspectorFeatureRequiresPhoto(field, next)) {
            clearInspectorPhotoDataUrl(liveDraft.taskId, photoRef);
          }
        }

        return (
          <div
            key={field.key}
            id={`ins-feature-${field.key}`}
            className={cn(
              "mb-4 rounded-xl p-2",
              (valueMissing || photoMissing) &&
                "border border-danger/40 bg-danger-bg/40",
            )}
          >
            <MobileFieldLabel shared={field.shared}>
              {field.label}
              {valueMissing ? (
                <span className="ms-1 text-[11px] font-bold text-danger">
                  (مطلوب)
                </span>
              ) : null}
            </MobileFieldLabel>
            {usePills ? (
              <MobilePills
                options={field.options}
                value={value}
                disabled={locked}
                onChange={setFeatureValue}
              />
            ) : (
              <>
                <MobileSuggestRow
                  fieldKey={field.key}
                  value={value}
                  disabled={locked}
                  onPick={setFeatureValue}
                />
                <MobileSearchSelect
                  options={field.options}
                  value={value}
                  disabled={locked}
                  onChange={setFeatureValue}
                />
              </>
            )}
            {needsPhoto ? (
              <div className="mt-2.5">
                {attachment?.fileName ? (
                  <InspectorStampedPhotoThumb
                    stamp={photoStamp}
                    taskId={draft.taskId}
                    photoRef={photoRef}
                    attachment={attachment}
                    onClear={
                      locked
                        ? undefined
                        : () => {
                            clearInspectorPhotoDataUrl(
                              draft.taskId,
                              photoRef,
                            );
                            persist({
                              featurePhotoAttachments: {
                                ...draft.featurePhotoAttachments,
                                [field.key]: null,
                              },
                            });
                          }
                    }
                  />
                ) : (
                  <InspectorPhotoFilePicker
                    label="صورة إثبات مطلوبة — التقاط *"
                    disabled={locked}
                    className="[&_button]:min-h-12 [&_button]:rounded-xl [&_button]:border-[1.5px] [&_button]:border-dashed [&_button]:border-[var(--gold-d,#a4906f)] [&_button]:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] [&_button]:text-[13.5px] [&_button]:font-bold [&_button]:text-[var(--gold-d,#a4906f)]"
                    onFilesSelected={async (files) => {
                      const file = files[0];
                      if (!file) return false;
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        photoRef,
                        file,
                        {
                          draft: liveDraft,
                          deedNumber: property?.deedNumber,
                        },
                      );
                      if (!result.ok) {
                        throw new Error(result.error);
                      }
                      persist({
                        featurePhotoAttachments: {
                          ...draft.featurePhotoAttachments,
                          [field.key]: result.attachment,
                        },
                      });
                    }}
                  />
                )}
              </div>
            ) : null}
            {fi === 0 && !isLandInspection ? (
              <div className="mt-4">
                <MobileFieldLabel shared>
                  عمر العقار (سنوات)
                </MobileFieldLabel>
                <MobileCountStepper
                  label="العمر"
                  value={draft.propertyAgeYears}
                  disabled={locked}
                  onChange={(v) => persist({ propertyAgeYears: v })}
                />
              </div>
            ) : null}
            {field.key === "movables" && isMovablesPresent(draft.featureValues) ? (
              <InspectorMovablesDescriptionField
                value={draft.featureValues[MOVABLES_DESCRIPTION_KEY] ?? ""}
                disabled={locked}
                invalid={Boolean(fieldErrors.movablesDescription)}
                onChange={(next) =>
                  persist({
                    featureValues: {
                      ...draft.featureValues,
                      [MOVABLES_DESCRIPTION_KEY]: next,
                    },
                  })
                }
              />
            ) : null}
            {field.key === OCCUPANCY_STATE_KEY && isOccupied(draft.featureValues) ? (
              <InspectorOccupancyDescriptionField
                value={draft.featureValues[OCCUPANCY_DESCRIPTION_KEY] ?? ""}
                disabled={locked}
                invalid={Boolean(fieldErrors.occupancyDescription)}
                onChange={(next) =>
                  persist({
                    featureValues: {
                      ...draft.featureValues,
                      [OCCUPANCY_DESCRIPTION_KEY]: next,
                    },
                  })
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
    {fieldErrors.featurePhotos ? (
      <p className="mt-2 text-[10px] text-danger-text" role="alert">
        {fieldErrors.featurePhotos}
      </p>
    ) : null}
  </InspectorCard>
  );
}
