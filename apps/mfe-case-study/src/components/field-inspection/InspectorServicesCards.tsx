"use client";

/**
 * Step-2 cards «الخدمات والمرافق المحيطة» (multi-select chips) and the
 * conditional «عدادات الخدمات» meter fields. Lifted out of
 * `FieldInspectionWorkBody` — same markup, state stays with the workflow hook.
 */
import { FormRow } from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_SERVICE_OPTIONS,
  inspectorAmenityLabel,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileChips, MobileFieldLabel } from "./InspectMobileControls";
import { inspectorServiceMeters } from "./field-inspection-work-state";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";

/**
 * The «عدادات الخدمات» fields: count and numbers of the electricity and water meters the inspector found.
 *
 * How it works: shows the electricity pair when «كهرباء» is among the services and the water pair when «ماء»
 * is; renders nothing when neither is. Read-only when `disabled`.
 *
 * Edge cases: shared by the phone body (`InspectorServicesCards`) and the desktop wizard
 * (`InspectorWizardServicesCard`) since A→Z 2026-11-02 #31 — the desktop had no meter fields at all, so the
 * valuation report always printed the meters «—».
 */
export function InspectorServiceMeterFields({
  draft,
  disabled = false,
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  disabled?: boolean;
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
}) {
  const meters = inspectorServiceMeters(draft.services);
  if (!meters.any) return null;
  const change = (patch: InspectorWorkspacePatchInput) => {
    if (!disabled) onPatch(patch);
  };
  return (
    <FormRow className="grid-cols-1 sm:grid-cols-2">
      {meters.electricity ? (
        <>
          <RegField
            id="ins-elec-meter-count"
            label="عدد عدادات الكهرباء"
            type="number"
            readOnly={disabled}
            value={draft.electricityMeterCount}
            onChange={(v) => change({ electricityMeterCount: v })}
          />
          <RegField
            id="ins-elec-meter-nos"
            label="أرقام عدادات الكهرباء"
            readOnly={disabled}
            value={draft.electricityMeterNumbers}
            onChange={(v) => change({ electricityMeterNumbers: v })}
          />
        </>
      ) : null}
      {meters.water ? (
        <>
          <RegField
            id="ins-water-meter-count"
            label="عدد عدادات الماء"
            type="number"
            readOnly={disabled}
            value={draft.waterMeterCount}
            onChange={(v) => change({ waterMeterCount: v })}
          />
          <RegField
            id="ins-water-meter-nos"
            label="أرقام عدادات الماء"
            readOnly={disabled}
            value={draft.waterMeterNumbers}
            onChange={(v) => change({ waterMeterNumbers: v })}
          />
        </>
      ) : null}
    </FormRow>
  );
}

export function InspectorServicesCards({
  activeStep,
  draft,
  layout,
  locked,
  mobile,
  persist,
}: Pick<FieldInspectionWorkflow, "activeStep" | "locked" | "persist"> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
}) {
  const meters = inspectorServiceMeters(draft.services);
  return (
    <>
      <InspectorCard
        title={mobile ? "الخدمات والمرافق" : "الخدمات والمرافق المحيطة"}
        hidden={activeStep !== 2}
        icon="ti-plug"
        badge={mobile ? undefined : <InsBadge label="اختيار متعدد" />}
        layout={layout}
        step={5}
        subtitle={mobile ? "اختيار متعدد" : undefined}
      >
        {mobile ? (
          <>
            <MobileFieldLabel>الخدمات المتوفرة</MobileFieldLabel>
            <MobileChips
              options={INSPECTOR_SERVICE_OPTIONS}
              selected={draft.services}
              disabled={locked}
              onChange={(services) => persist({ services })}
            />
            <div className="h-4" />
            <MobileFieldLabel>المرافق المحيطة</MobileFieldLabel>
            <MobileChips
              options={INSPECTOR_AMENITY_OPTIONS}
              selected={draft.amenities}
              disabled={locked}
              labelOf={inspectorAmenityLabel}
              onChange={(amenities) => persist({ amenities })}
            />
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-semibold text-text-2">
              الخدمات المتوفرة
            </p>
            <MobileChips
              options={INSPECTOR_SERVICE_OPTIONS}
              selected={draft.services}
              disabled={locked}
              onChange={(services) => persist({ services })}
            />
            <p className="mb-2 mt-3.5 text-[11px] font-semibold text-text-2">
              المرافق المحيطة
            </p>
            <MobileChips
              options={INSPECTOR_AMENITY_OPTIONS}
              selected={draft.amenities}
              disabled={locked}
              labelOf={inspectorAmenityLabel}
              onChange={(amenities) => persist({ amenities })}
            />
          </>
        )}
      </InspectorCard>

      {meters.any ? (
        <InspectorCard
          title="عدادات الخدمات"
          hidden={activeStep !== 2}
          icon="ti-hash"
          layout={layout}
        >
          <InspectorServiceMeterFields draft={draft} disabled={locked} onPatch={persist} />
        </InspectorCard>
      ) : null}
    </>
  );
}
