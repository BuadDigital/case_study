"use client";

/**
 * Step-2 card «مساحات المباني»: built areas, building licence, the building
 * inventory and the inspection limits. Lifted out of `FieldInspectionWorkBody`
 * — same markup, state stays with the workflow hook.
 */
import { cn, FormRow, Input } from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import { InsDualCalendarDateField } from "../po-intake/PropertyDetailInspectionParts";
import { INFATH_FIELD_LABELS } from "../../lib/app-data/infath-field-labels";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import { BuildingInventorySection } from "./BuildingInventorySection";
import { InspectionLimitsSection } from "./InspectionLimitsSection";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileFieldLabel, mobileControlClassName } from "./InspectMobileControls";
import { INSPECTOR_BUILDING_AREA_INPUTS } from "./field-inspection-work-state";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function InspectorBuildingAreasCard({
  activeStep,
  draft,
  isLandInspection,
  layout,
  locked,
  mobile,
  persist,
  poNumber,
  propertyId,
  workLocked,
}: Pick<
  FieldInspectionWorkflow,
  "activeStep" | "locked" | "persist" | "propertyId" | "workLocked"
> & {
  draft: InspectorWorkspaceDraft;
  isLandInspection: boolean;
  layout: "desktop" | "mobile";
  mobile: boolean;
  poNumber: string;
}) {
  return (
    <InspectorCard
      title={mobile ? "مساحات المباني" : "مساحات المباني"}
      hidden={activeStep !== 2}
      icon="ti-ruler-measure"
      badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
      layout={layout}
      step={3}
      subtitle={mobile ? "م²" : undefined}
    >
      {!isLandInspection ? (
      <>
      {mobile ? (
        <div className="grid gap-3.5">
          {INSPECTOR_BUILDING_AREA_INPUTS.map(([key, label]) => (
            <div key={key}>
              <MobileFieldLabel>{label}</MobileFieldLabel>
              <Input
                id={`ins-${key}`}
                type="number"
                value={draft[key]}
                disabled={locked}
                onChange={(e) => persist({ [key]: e.target.value })}
                className={mobileControlClassName}
              />
            </div>
          ))}
          <div>
            <MobileFieldLabel>{INFATH_FIELD_LABELS.buildingsTotal}</MobileFieldLabel>
            <Input
              id="ins-buildingsTotal"
              type="number"
              value={draft.buildingsTotal}
              disabled
              readOnly
              className={cn(mobileControlClassName, "text-center [direction:ltr] [unicode-bidi:isolate]")}
            />
          </div>
          <div>
            <MobileFieldLabel>رقم رخصة البناء</MobileFieldLabel>
            <Input
              id="ins-build-license"
              value={draft.buildLicenseNumber}
              disabled={locked}
              onChange={(e) =>
                persist({ buildLicenseNumber: e.target.value })
              }
              className={mobileControlClassName}
            />
          </div>
          <InsDualCalendarDateField
            id="ins-build-license-date"
            label="تاريخ رخصة البناء"
            value={draft.buildLicenseDate}
            disabled={locked}
            onChange={(v) => persist({ buildLicenseDate: v })}
          />
        </div>
      ) : (
        <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {INSPECTOR_BUILDING_AREA_INPUTS.map(([key, label]) => (
            <RegField
              key={key}
              id={`ins-${key}`}
              label={label}
              type="number"
              value={draft[key]}
              onChange={(v) => persist({ [key]: v })}
            />
          ))}
          <RegField
            id="ins-buildingsTotal"
            label={INFATH_FIELD_LABELS.buildingsTotal}
            type="number"
            value={draft.buildingsTotal}
            dir="ltr"
            readOnly
            className="[&_input]:text-center"
            onChange={() => {}}
          />
          <RegField
            id="ins-build-license"
            label="رقم رخصة البناء"
            value={draft.buildLicenseNumber}
            onChange={(v) => persist({ buildLicenseNumber: v })}
          />
          <InsDualCalendarDateField
            id="ins-build-license-date-desktop"
            label="تاريخ رخصة البناء"
            value={draft.buildLicenseDate}
            disabled={locked}
            onChange={(v) => persist({ buildLicenseDate: v })}
          />
        </FormRow>
      )}
      <BuildingInventorySection
        poNumber={poNumber}
        propertyId={propertyId}
        disabled={workLocked}
        mobile={mobile}
      />
      </>
      ) : null}
      <InspectionLimitsSection
        poNumber={poNumber}
        propertyId={propertyId}
        disabled={workLocked}
        mobile={mobile}
      />
    </InspectorCard>
  );
}
