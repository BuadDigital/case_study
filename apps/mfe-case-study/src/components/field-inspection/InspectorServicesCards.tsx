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
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileChips, MobileFieldLabel } from "./InspectMobileControls";
import { inspectorServiceMeters } from "./field-inspection-work-state";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

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
          <FormRow className="grid-cols-1 sm:grid-cols-2">
            {meters.electricity ? (
              <>
                <RegField
                  id="ins-elec-meter-count"
                  label="عدد عدادات الكهرباء"
                  type="number"
                  value={draft.electricityMeterCount}
                  onChange={(v) => persist({ electricityMeterCount: v })}
                />
                <RegField
                  id="ins-elec-meter-nos"
                  label="أرقام عدادات الكهرباء"
                  value={draft.electricityMeterNumbers}
                  onChange={(v) => persist({ electricityMeterNumbers: v })}
                />
              </>
            ) : null}
            {meters.water ? (
              <>
                <RegField
                  id="ins-water-meter-count"
                  label="عدد عدادات الماء"
                  type="number"
                  value={draft.waterMeterCount}
                  onChange={(v) => persist({ waterMeterCount: v })}
                />
                <RegField
                  id="ins-water-meter-nos"
                  label="أرقام عدادات الماء"
                  value={draft.waterMeterNumbers}
                  onChange={(v) => persist({ waterMeterNumbers: v })}
                />
              </>
            ) : null}
          </FormRow>
        </InspectorCard>
      ) : null}
    </>
  );
}
