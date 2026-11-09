"use client";

/**
 * Wizard step 2 cards of `InspectorWorkspaceWizard` - property components
 * (counts, boolean pills, annex) and building areas. Both hidden for land.
 */

import {
  InsCard,
  InsDualCalendarDateField,
  InsEditField,
  InsFieldsGrid,
  ComponentCountWithPhotoField,
} from "../po-intake/PropertyDetailInspectionParts";
import {
  visibleInspectorFeatureFields,
  isShopHiddenInspectorComponentKey,
  type InspectorComponentPhotoKey,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  INSPECTOR_ANNEX_COUNT_FIELDS,
  annexAnswerPatch,
  inspectorBoolPillClass,
  inspectorComponentCountFields,
  listComponentBoolPhotoSlots,
} from "./inspector-wizard-state";
import { InspectorComponentBoolPills, InspectorPresentChip } from "./InspectorComponentBoolPills";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";
import { wholeCountInput } from "../../lib/app-data/specialist-components";

/**
 * The desktop wizard's «مكونات العقار» and «رخصة البناء» cards (none for land).
 *
 * How it works: the counts come from `inspectorComponentCountFields(isShop)` — the phone's list —
 * with a proof-photo field for a showroom / well; then the «يوجد ملحق» pill with the annex counts
 * (`INSPECTOR_ANNEX_COUNT_FIELDS`, saved through `annexAnswerPatch`) and the yes/no component pills.
 *
 * Edge cases: fixed 2026-11-04 — seven counts (جاكوزي، غرف الطعام، المجالس، غرف الخدم، غرفة حارس،
 * مستودع، ملاعب أطفال) existed on the phone only; the annex was two checkboxes that stored «1»
 * whatever the real count; a commercial shop still showed «يوجد ملحق» (the phone hides it).
 */
export function InspectorWizardComponentsCards({
  deedNumber,
  draft,
  editable,
  locked,
  isLand,
  isShop,
  missingFeaturePhotoKey,
  missingComponentPhotoKey,
  onPatch,
}: {
  deedNumber: string;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  locked: boolean;
  isLand: boolean;
  isShop: boolean;
  /** Validation focus target — highlights the pill whose proof photo is missing. */
  missingFeaturePhotoKey?: string;
  // Never "buildLicense" in practice — no required-photo gate exists for it (inspector-workspace-validation.ts:342).
  missingComponentPhotoKey?: InspectorComponentPhotoKey;
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
}) {
  const showShop = (key: string) =>
    !isShop || !isShopHiddenInspectorComponentKey(key);
  const hasAnyPresentItem =
    draft.hasAnnex === "نعم" ||
    listComponentBoolPhotoSlots(draft, visibleInspectorFeatureFields(false), isLand).some(
      (slot) => slot.on,
    );

  return (
    <>
      {!isLand ? (
        <div id="ins-components-section">
        <InsCard title="مكونات العقار">
          {/* The phone's count list (`inspectorComponentCountFields`) — A→Z 2026-11-02 #33 found
              «مواقف» on the phone only; 2026-11-04 seven more counts were phone-only. */}
          <InsFieldsGrid min={130} centered>
            {inspectorComponentCountFields(isShop).map((field) =>
              field.photo ? (
                <ComponentCountWithPhotoField
                  key={field.key}
                  label={field.label}
                  countValue={draft[field.key]}
                  photoKey={field.photo.key}
                  photoLabel={field.photo.label}
                  attachment={draft.componentPhotoAttachments[field.photo.key]}
                  taskId={draft.taskId}
                  stamp=""
                  deedNumber={deedNumber}
                  draft={draft}
                  editMode={editable}
                  disabled={locked}
                  invalid={missingComponentPhotoKey === field.photo.key}
                  onPatch={onPatch}
                />
              ) : (
                <InsEditField
                  key={field.key}
                  id={`ins-${field.key}`}
                  label={field.label}
                  value={draft[field.key]}
                  ltr
                  onChange={(v) => onPatch({ [field.key]: wholeCountInput(v) })}
                  disabled={!editable}
                />
              ),
            )}
          </InsFieldsGrid>
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {/* A commercial shop records no annex — hidden like on the phone (2026-11-04). */}
            {!showShop("hasAnnex") ? null : editable ? (
              <button
                type="button"
                className={inspectorBoolPillClass(draft.hasAnnex === "نعم")}
                onClick={() =>
                  onPatch(annexAnswerPatch(draft.hasAnnex === "نعم" ? "لا" : "نعم"))
                }
              >
                يوجد ملحق
              </button>
            ) : draft.hasAnnex === "نعم" ? (
              <InspectorPresentChip label="يوجد ملحق" />
            ) : null}
            <InspectorComponentBoolPills
              deedNumber={deedNumber}
              draft={draft}
              editable={editable}
              isLand={isLand}
              missingFeaturePhotoKey={missingFeaturePhotoKey}
              onPatch={onPatch}
            />
            {!editable && !hasAnyPresentItem ? (
              <span className="text-[11.5px] text-text-3">
                لا توجد إضافات أو ملاحق مسجّلة.
              </span>
            ) : null}
          </div>
          {/* Annex counts as numbers, like the phone — the old checkboxes stored only «1». */}
          {showShop("hasAnnex") && draft.hasAnnex === "نعم" ? (
            <div className="mt-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
              <InsFieldsGrid min={130} centered>
                {INSPECTOR_ANNEX_COUNT_FIELDS.map(({ key, label }) => (
                  <InsEditField
                    key={key}
                    id={`ins-${key}`}
                    label={label}
                    value={draft[key]}
                    ltr
                    onChange={(v) => onPatch({ [key]: wholeCountInput(v) })}
                    disabled={!editable}
                  />
                ))}
              </InsFieldsGrid>
            </div>
          ) : null}
        </InsCard>
        </div>
      ) : null}

      {!isLand ? (
        // Building areas are the case specialist's («مكونات العقار») — only the licence stays here.
        <InsCard title="رخصة البناء">
          <InsFieldsGrid min={140} centered>
            <InsEditField
              label="رقم رخصة البناء"
              value={draft.buildLicenseNumber}
              ltr
              onChange={(v) =>
                editable && onPatch({ buildLicenseNumber: v })
              }
            disabled={!editable} />
            <InsDualCalendarDateField
              id="ins-build-license-date"
              label="تاريخ رخصة البناء"
              value={draft.buildLicenseDate}
              disabled={!editable}
              onChange={(v) =>
                editable && onPatch({ buildLicenseDate: v })
              }
            />
          </InsFieldsGrid>
        </InsCard>
      ) : null}
    </>
  );
}
