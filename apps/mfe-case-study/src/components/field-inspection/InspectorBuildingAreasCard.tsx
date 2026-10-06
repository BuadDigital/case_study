"use client";

/**
 * Step-2 card: the building licence and the inspection limits. The inspector also fills the
 * building inventory «جدول الحصر» (its own card, `InspectorInventoryCard`); the report's
 * «مكونات العقار» text stays the case specialist's, written from the inspector's description
 * text or photo. Lifted out of `FieldInspectionWorkBody` — same markup, state stays with the
 * workflow hook.
 */
import { cn, FormRow, Input } from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import { InsDualCalendarDateField } from "../po-intake/PropertyDetailInspectionParts";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { InspectionLimitsSection } from "./InspectionLimitsSection";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileFieldLabel, mobileControlClassName } from "./InspectMobileControls";
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
  property: _property,
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
  /** Kept for caller compatibility (licence photo UI removed). */
  property?: PoPropertyIntake | null;
}) {
  return (
    <InspectorCard
      title="رخصة البناء"
      hidden={activeStep !== 2}
      icon="ti-ruler-measure"
      badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
      layout={layout}
      step={3}
    >
      {!isLandInspection ? (
        mobile ? (
          <div className="grid gap-3.5">
            <div>
              <MobileFieldLabel>رقم رخصة البناء</MobileFieldLabel>
              <Input
                id="ins-build-license"
                value={draft.buildLicenseNumber}
                disabled={locked}
                onChange={(e) => persist({ buildLicenseNumber: e.target.value })}
                className={cn(mobileControlClassName)}
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
          <FormRow className="grid-cols-1 sm:grid-cols-2">
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
        )
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
