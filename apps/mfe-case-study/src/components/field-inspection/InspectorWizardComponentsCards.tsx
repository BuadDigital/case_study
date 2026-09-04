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
  isShopHiddenInspectorComponentKey,
  patchInspectorFeatureValues,
  visibleInspectorFeatureFields,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { INFATH_FIELD_LABELS } from "../../lib/app-data/infath-field-labels";
import {
  COMPONENT_BOOL_KEYS,
  inspectorBoolPillClass,
} from "./inspector-wizard-state";

export function InspectorWizardComponentsCards({
  deedNumber,
  draft,
  editable,
  locked,
  isLand,
  isShop,
  onPatch,
}: {
  deedNumber: string;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  locked: boolean;
  isLand: boolean;
  isShop: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const showShop = (key: string) =>
    !isShop || !isShopHiddenInspectorComponentKey(key);

  return (
    <>
      {!isLand ? (
        <InsCard title="مكوّنات العقار">
          <InsFieldsGrid min={130} centered>
            {showShop("roomCount") ? (
              <InsEditField
                label="عدد الغرف"
                value={draft.roomCount}
                ltr
                
                onChange={(v) => onPatch({ roomCount: v })}
              disabled={!editable} />
            ) : null}
            {showShop("hallCount") ? (
              <InsEditField
                label="عدد الصالات"
                value={draft.hallCount}
                ltr
                
                onChange={(v) => onPatch({ hallCount: v })}
              disabled={!editable} />
            ) : null}
            {showShop("unitCount") ? (
              <InsEditField
                label="عدد الشقق"
                value={draft.unitCount}
                ltr
                
                onChange={(v) => onPatch({ unitCount: v })}
              disabled={!editable} />
            ) : null}
            <InsEditField
              label="دورات المياه"
              value={draft.bathroomCount}
              ltr
              
              onChange={(v) => onPatch({ bathroomCount: v })}
            disabled={!editable} />
            <ComponentCountWithPhotoField
              label="المعارض"
              countValue={draft.showroomCount}
              photoKey="showroom"
              photoLabel="إرفاق صورة للمعرض التجاري"
              attachment={draft.componentPhotoAttachments.showroom}
              taskId={draft.taskId}
              stamp=""
              deedNumber={deedNumber}
              draft={draft}
              editMode={editable}
              disabled={locked}
              onPatch={onPatch}
            />
            {showShop("wellCount") ? (
              <ComponentCountWithPhotoField
                label="الآبار"
                countValue={draft.wellCount}
                photoKey="well"
                photoLabel="إرفاق صورة البئر"
                attachment={draft.componentPhotoAttachments.well}
                taskId={draft.taskId}
                stamp=""
                deedNumber={deedNumber}
                draft={draft}
                editMode={editable}
                disabled={locked}
                onPatch={onPatch}
              />
            ) : null}
            {showShop("towerCount") ? (
              <InsEditField
                label="الأبراج"
                value={draft.towerCount}
                ltr
                
                onChange={(v) => onPatch({ towerCount: v })}
              disabled={!editable} />
            ) : null}
          </InsFieldsGrid>
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled={!editable}
              className={inspectorBoolPillClass(draft.hasAnnex === "نعم", !editable)}
              onClick={() =>
                editable &&
                onPatch({
                  hasAnnex: draft.hasAnnex === "نعم" ? "لا" : "نعم",
                })
              }
            >
              يوجد ملحق
            </button>
            {COMPONENT_BOOL_KEYS.map((key) => {
              const field = visibleInspectorFeatureFields(false).find(
                (f) => f.key === key,
              );
              if (!field || isLand) return null;
              const on = (draft.featureValues[key] ?? "") === "نعم";
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!editable}
                  className={inspectorBoolPillClass(on, !editable)}
                  onClick={() =>
                    editable &&
                    onPatch({
                      featureValues: patchInspectorFeatureValues(
                        draft.featureValues,
                        key,
                        on ? "لا" : "نعم",
                      ),
                    })
                  }
                >
                  {field.label}
                </button>
              );
            })}
          </div>
          {draft.hasAnnex === "نعم" ? (
            <div className="mt-2.5 flex flex-wrap gap-4 rounded-lg bg-surface-2 px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
                <input
                  type="checkbox"
                  className="size-[15px] accent-ink"
                  checked={Boolean(draft.annexUpperCount.trim())}
                  
                  onChange={(e) =>
                    onPatch({
                      annexUpperCount: e.target.checked ? "1" : "",
                    })
                  }
                />
                ملحق علوي
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
                <input
                  type="checkbox"
                  className="size-[15px] accent-ink"
                  checked={Boolean(draft.annexGroundCount.trim())}
                  
                  onChange={(e) =>
                    onPatch({
                      annexGroundCount: e.target.checked ? "1" : "",
                    })
                  }
                />
                ملحق سفلي
              </label>
            </div>
          ) : null}
        </InsCard>
      ) : null}

      {!isLand ? (
        <InsCard title="مساحات المباني">
          <InsFieldsGrid min={140} centered>
            <InsEditField
              label="مساحة البناء (م²)"
              value={draft.builtArea}
              ltr
              onChange={(v) => editable && onPatch({ builtArea: v })}
            disabled={!editable} />
            <InsEditField
              label="عدد أدوار المباني"
              value={draft.buildingFloors}
              ltr
              onChange={(v) => editable && onPatch({ buildingFloors: v })}
            disabled={!editable} />
            <InsEditField
              label="إجمالي مساحة القبو (م²)"
              value={draft.basementTotal}
              ltr
              onChange={(v) => editable && onPatch({ basementTotal: v })}
            disabled={!editable} />
            <InsEditField
              label="إجمالي مساحة الملاحق (م²)"
              value={draft.annexTotal}
              ltr
              onChange={(v) => editable && onPatch({ annexTotal: v })}
            disabled={!editable} />
            <InsEditField
              label={INFATH_FIELD_LABELS.buildingsTotal}
              value={draft.buildingsTotal}
              ltr
              disabled
              onChange={() => {}}
            />
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
