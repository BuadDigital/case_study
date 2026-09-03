"use client";

/**
 * Step-2 card: property components (rooms, finishes, per-component photos).
 * Lifted out of `FieldInspectionWorkBody` as one self-contained section —
 * same markup, state stays with the parent.
 */
import {
  clearInspectorPhotoDataUrl,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import {
  isShopHiddenInspectorComponentKey,
  parseInspectorCount,
  type InspectorComponentPhotoKey,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  InsBadge,
  InspectorCard,
  MobileCountStepper,
} from "./FieldInspectionWorkParts";
import {
  MobileFieldLabel,
  MobilePills,
} from "./InspectMobileControls";
import {
  InspectorPhotoFilePicker,
} from "./InspectorPhotoFilePicker";
import {
  InspectorStampedPhotoThumb,
} from "./InspectorStampedPhotoThumb";
import {
  RegField,
} from "@platform/app-shared/registration/FormFields";
import {
  FormRow,
  Input,
  Select,
  cn,
  formControlClassName,
} from "@platform/ui-kit";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { RoleId } from "@platform/types";
import type { updateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";

export function InspectorComponentsSection({
  activeStep,
  cardLayout,
  draft,
  fieldErrors,
  isShopInspection,
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
  fieldErrors: InspectorWorkspaceFieldErrors;
  isShopInspection: boolean;
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
    <div id="ins-components-section">
  <InspectorCard
    title="مكوّنات العقار"
    hidden={activeStep !== 2}
    icon="ti-building-estate"
    badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
    layout={cardLayout}
    step={2}
    subtitle={mobile ? "الغرف والمرافق" : undefined}
  >
    <FormRow className={cn("grid-cols-1", !mobile && "sm:grid-cols-2 lg:grid-cols-3")}>
      {(
        [
          ["roomCount", "عدد الغرف", null],
          ["hallCount", "عدد الصالات", null],
          ["unitCount", "عدد الشقق", null],
          ["bathroomCount", "عدد دورات المياه", null],
          [
            "showroomCount",
            "عدد المعارض",
            {
              photoKey: "showroom" as InspectorComponentPhotoKey,
              photoLabel: "إرفاق صورة للمعرض التجاري",
            },
          ],
          [
            "wellCount",
            "عدد الآبار",
            {
              photoKey: "well" as InspectorComponentPhotoKey,
              photoLabel: "إرفاق صورة البئر",
            },
          ],
          ["towerCount", "عدد الأبراج", null],
          ["jacuzziCount", "جاكوزي", null],
          ["diningCount", "غرف الطعام", null],
          ["majlisCount", "المجالس", null],
          ["maidRoomCount", "غرف الخدم", null],
          ["guardRoomCount", "غرفة حارس", null],
          ["parkingCount", "مواقف", null],
          ["storeCount", "مستودع", null],
          ["playgroundCount", "ملاعب أطفال", null],
          ["propertyAgeYears", "عمر العقار (سنوات)", null],
        ] as const
      )
        .filter(([key]) => !(mobile && key === "propertyAgeYears"))
        .filter(
          ([key]) =>
            !(
              isShopInspection &&
              isShopHiddenInspectorComponentKey(key)
            ),
        )
        .map(([key, label, photoMeta]) => {
        if (key === "propertyAgeYears") {
          return (
            <div key={key}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <label
                  htmlFor="ins-propertyAgeYears"
                  className="text-[11px] font-semibold text-text-2"
                >
                  {label}
                </label>
                <InsBadge label="مشترك" tone="purple" />
              </div>
              <Input
                id="ins-propertyAgeYears"
                type="number"
                value={draft.propertyAgeYears}
                onChange={(e) =>
                  persist({ propertyAgeYears: e.target.value })
                }
                className="text-xs"
              />
            </div>
          );
        }

        const value = draft[key];
        const count = photoMeta ? parseInspectorCount(value) : 0;
        const attachment = photoMeta
          ? draft.componentPhotoAttachments[photoMeta.photoKey]
          : null;
        const photoRef = photoMeta
          ? `component:${photoMeta.photoKey}`
          : "";

        function setCount(next: string) {
          const patch: Partial<InspectorWorkspaceDraft> = {
            [key]: next,
          };
          if (photoMeta && parseInspectorCount(next) === 0) {
            clearInspectorPhotoDataUrl(liveDraft.taskId, photoRef);
            patch.componentPhotoAttachments = {
              ...liveDraft.componentPhotoAttachments,
              [photoMeta.photoKey]: null,
            };
          }
          persist(patch);
        }

        return (
          <div key={key}>
            {mobile ? (
              <MobileCountStepper
                label={label}
                value={value}
                disabled={locked}
                onChange={setCount}
              />
            ) : (
              <RegField
                id={`ins-${key}`}
                label={label}
                type="number"
                value={value}
                onChange={setCount}
              />
            )}
            {photoMeta && count > 0 ? (
              <div className="mt-1.5">
                {attachment?.fileName ? (
                  <InspectorStampedPhotoThumb
                    compact
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
                              componentPhotoAttachments: {
                                ...draft.componentPhotoAttachments,
                                [photoMeta.photoKey]: null,
                              },
                            });
                          }
                    }
                  />
                ) : (
                  <InspectorPhotoFilePicker
                    label={photoMeta.photoLabel}
                    disabled={locked}
                    className="w-auto"
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
                        componentPhotoAttachments: {
                          ...draft.componentPhotoAttachments,
                          [photoMeta.photoKey]: result.attachment,
                        },
                      });
                    }}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      {!isShopInspection ? (
      <>
      <div className={cn(mobile && "mt-4")}>
        {mobile ? (
          <>
            <MobileFieldLabel>هل يوجد ملحق؟</MobileFieldLabel>
            <MobilePills
              options={["نعم", "لا"]}
              value={draft.hasAnnex}
              disabled={locked}
              onChange={(next) =>
                persist({
                  hasAnnex: next as InspectorWorkspaceDraft["hasAnnex"],
                  ...(next === "لا"
                    ? { annexUpperCount: "", annexGroundCount: "" }
                    : {}),
                })
              }
            />
          </>
        ) : (
          <>
            <label
              htmlFor="ins-has-annex"
              className="mb-1 block text-[11px] font-semibold text-text-2"
            >
              يوجد ملاحق؟
            </label>
            <Select
              id="ins-has-annex"
              value={draft.hasAnnex}
              onChange={(e) => {
                const next = e.target
                  .value as InspectorWorkspaceDraft["hasAnnex"];
                persist({
                  hasAnnex: next,
                  ...(next === "لا"
                    ? { annexUpperCount: "", annexGroundCount: "" }
                    : {}),
                });
              }}
              className={cn(formControlClassName, "text-xs")}
            >
              <option value="">— اختر —</option>
              <option value="نعم">نعم</option>
              <option value="لا">لا</option>
            </Select>
          </>
        )}
      </div>
      {draft.hasAnnex === "نعم" ? (
        <>
          {mobile ? (
            <>
              <div className="mt-4">
                <MobileCountStepper
                  label="ملحق علوي (عدد)"
                  value={draft.annexUpperCount}
                  disabled={locked}
                  onChange={(next) => persist({ annexUpperCount: next })}
                />
              </div>
              <div className="mt-4">
                <MobileCountStepper
                  label="ملحق أرضي (عدد)"
                  value={draft.annexGroundCount}
                  disabled={locked}
                  onChange={(next) => persist({ annexGroundCount: next })}
                />
              </div>
            </>
          ) : (
            <>
              <RegField
                id="ins-annexUpperCount"
                label="ملحق علوي (عدد)"
                type="number"
                value={draft.annexUpperCount}
                onChange={(v) => persist({ annexUpperCount: v })}
              />
              <RegField
                id="ins-annexGroundCount"
                label="ملحق أرضي (عدد)"
                type="number"
                value={draft.annexGroundCount}
                onChange={(v) => persist({ annexGroundCount: v })}
              />
            </>
          )}
        </>
      ) : null}
      </>
      ) : null}
    </FormRow>
    {fieldErrors.componentPhotos ? (
      <p className="mt-2 text-[10px] text-danger-text" role="alert">
        {fieldErrors.componentPhotos}
      </p>
    ) : null}
  </InspectorCard>
    </div>
  );
}
