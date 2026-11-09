"use client";

/**
 * Step-2 card: property components (rooms, finishes, per-component photos).
 * Lifted out of `FieldInspectionWorkBody` as one self-contained section —
 * same markup, state stays with the parent.
 */
import { clearInspectorPhotoDataUrl } from "../../lib/app-data/inspector-photo-upload";
import {
  parseInspectorCount,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  INSPECTOR_ANNEX_COUNT_FIELDS,
  annexAnswerPatch,
  inspectorComponentCountFields,
} from "./inspector-wizard-state";
import {
  InsBadge,
  InspectorCard,
  MobileCountStepper,
} from "./FieldInspectionWorkParts";
import {
  MobileFieldLabel,
  MobilePills,
} from "./InspectMobileControls";
import { InspectorPhotoThumbOrPicker } from "./InspectorPhotoThumbOrPicker";
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
import { invalidControlClass } from "@platform/app-shared/form-ux";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { RoleId } from "@platform/types";
import type { updateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import { componentPhotoPatch } from "../../lib/app-data/inspector-workspace-model";

/**
 * The phone's «مكونات العقار» card: every component count, the proof photo of a showroom / well,
 * and «هل يوجد ملحق؟» with the annex counts.
 *
 * How it works: the counts come from `inspectorComponentCountFields(isShopInspection)` and the
 * annex counts from `INSPECTOR_ANNEX_COUNT_FIELDS` — the same lists the desktop wizard renders;
 * an annex answer is saved through `annexAnswerPatch` («لا» empties the counts).
 *
 * Edge cases: a count dropping to zero clears its proof photo. A commercial shop hides the
 * shop-hidden counts and the annex question. Changed 2026-11-04: the list moved to
 * `inspector-wizard-state.ts` so the desktop can no longer miss a count the phone has.
 */
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
    title="مكونات العقار"
    hidden={activeStep !== 2}
    icon="ti-building-estate"
    badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
    layout={cardLayout}
    step={2}
    subtitle={mobile ? "الغرف والمرافق" : undefined}
  >
    <FormRow className={cn("grid-cols-1", !mobile && "sm:grid-cols-2 lg:grid-cols-3")}>
      {/* One count list for both devices — `inspectorComponentCountFields` (shop filter included). */}
      {inspectorComponentCountFields(isShopInspection).map(({ key, label, photo }) => {
        const photoMeta = photo ? { photoKey: photo.key, photoLabel: photo.label } : null;
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
              <div
                id={`ins-component-photo-${photoMeta.photoKey}`}
                className={cn(
                  "mt-1.5",
                  fieldErrors.missingComponentPhotoKey === photoMeta.photoKey &&
                    invalidControlClass,
                  fieldErrors.missingComponentPhotoKey === photoMeta.photoKey &&
                    "rounded-md p-0.5",
                )}
              >
                <InspectorPhotoThumbOrPicker
                  compact
                  stamp={photoStamp}
                  taskId={draft.taskId}
                  photoRef={photoRef}
                  attachment={attachment}
                  disabled={locked}
                  pickerLabel={photoMeta.photoLabel}
                  pickerClassName="w-auto"
                  uploadContext={{
                    draft: liveDraft,
                    deedNumber: property?.deedNumber,
                  }}
                  onAttachmentChange={(photo) =>
                    persist(componentPhotoPatch(photoMeta.photoKey, photo))
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {!mobile ? (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <label
              htmlFor="ins-propertyAgeYears"
              className="text-[11px] font-semibold text-text-2"
            >
              عمر العقار (سنوات)
            </label>
            <InsBadge label="مشترك" tone="purple" />
          </div>
          <Input
            id="ins-propertyAgeYears"
            type="number"
            value={draft.propertyAgeYears}
            onChange={(e) => persist({ propertyAgeYears: e.target.value })}
            className="text-xs"
          />
        </div>
      ) : null}
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
                persist(annexAnswerPatch(next as InspectorWorkspaceDraft["hasAnnex"]))
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
              onChange={(e) =>
                persist(annexAnswerPatch(e.target.value as InspectorWorkspaceDraft["hasAnnex"]))
              }
              className={cn(formControlClassName, "text-xs")}
            >
              <option value="">— اختر —</option>
              <option value="نعم">نعم</option>
              <option value="لا">لا</option>
            </Select>
          </>
        )}
      </div>
      {draft.hasAnnex === "نعم"
        ? INSPECTOR_ANNEX_COUNT_FIELDS.map(({ key, label }) =>
            mobile ? (
              <div key={key} className="mt-4">
                <MobileCountStepper
                  label={label}
                  value={draft[key]}
                  disabled={locked}
                  onChange={(next) => persist({ [key]: next })}
                />
              </div>
            ) : (
              <RegField
                key={key}
                id={`ins-${key}`}
                label={label}
                type="number"
                value={draft[key]}
                onChange={(v) => persist({ [key]: v })}
              />
            ),
          )
        : null}
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
