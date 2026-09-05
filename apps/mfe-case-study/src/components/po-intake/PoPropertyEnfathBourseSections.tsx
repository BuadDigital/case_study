"use client";

/** Enfath form — bourse-inquiry primary sections (deed, mandate, plan, owner/court). */

import { RegField } from "@platform/app-shared/registration/FormFields";
import { FormRow, InfathSection } from "@platform/ui-kit";
import { CourtCircuitSelects } from "./CourtCircuitSelects";
import type { EnfathSectionProps } from "./po-property-enfath-form-state";

export function PoPropertyEnfathBourseSections({
  property,
  fieldErrors,
  onPatch,
  showCourt,
  showRequestNumber,
  onDeedNumberChange,
}: EnfathSectionProps & {
  showCourt: boolean;
  showRequestNumber: boolean;
  onDeedNumberChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
    <InfathSection title="بيانات الصك">
      <FormRow>
      <RegField
        id="deed_number_bourse"
        label="رقم الصك"
        required
        dir="ltr"
        inputMode="numeric"
        value={property.deedNumber}
        error={fieldErrors.deedNumber}
        onChange={onDeedNumberChange}
      />
      <RegField
        id="deed_date_bourse"
        label="تاريخ الصك"
        required
        type="date"
        value={property.deedDate}
        error={fieldErrors.deedDate}
        onChange={(v) => onPatch("deedDate", v)}
      />
      </FormRow>
    </InfathSection>

    <InfathSection title="التكليف">
      <FormRow>
      <RegField
        id="assignment_mandate_number_bourse"
        label="رقم التكليف"
        required
        dir="ltr"
        value={property.assignmentMandateNumber}
        error={fieldErrors.assignmentMandateNumber}
        onChange={(v) => onPatch("assignmentMandateNumber", v)}
      />
      <RegField
        id="assignment_mandate_date_bourse"
        label="تاريخ التكليف"
        required
        type="date"
        value={property.assignmentMandateDate}
        error={fieldErrors.assignmentMandateDate}
        onChange={(v) => onPatch("assignmentMandateDate", v)}
      />
      {showRequestNumber ? (
        <RegField
          id="request_number_bourse"
          label="رقم الطلب"
          required
          dir="ltr"
          value={property.requestNumber}
          error={fieldErrors.requestNumber}
          onChange={(v) => onPatch("requestNumber", v)}
        />
      ) : null}
      </FormRow>
    </InfathSection>

    <InfathSection title="بيانات المخطط والموقع">
      <FormRow>
        <RegField
          id="plan_number_bourse"
          label="رقم المخطط"
          dir="ltr"
          value={property.planNumber}
          error={fieldErrors.planNumber}
          onChange={(v) => onPatch("planNumber", v)}
        />
        <RegField
          id="plot_number_bourse"
          label="رقم القطعة"
          dir="ltr"
          value={property.plotNumber}
          error={fieldErrors.plotNumber}
          onChange={(v) => onPatch("plotNumber", v)}
        />
        <RegField
          id="plan_name_bourse"
          label="اسم المخطط"
          value={property.planName}
          error={fieldErrors.planName}
          onChange={(v) => onPatch("planName", v)}
        />
        <RegField
          id="block_number_bourse"
          label="رقم البلك"
          dir="ltr"
          value={property.blockNumber}
          error={fieldErrors.blockNumber}
          onChange={(v) => onPatch("blockNumber", v)}
        />
        <RegField
          id="partition_minutes_number"
          label="محضر التجزئة (رقم)"
          dir="ltr"
          value={property.partitionMinutesNumber}
          onChange={(v) => onPatch("partitionMinutesNumber", v)}
        />
        <RegField
          id="partition_minutes_date"
          label="محضر التجزئة (تاريخ)"
          type="date"
          dir="ltr"
          value={property.partitionMinutesDate}
          onChange={(v) => onPatch("partitionMinutesDate", v)}
        />
        <RegField
          id="location_map_url_bourse"
          label="رابط موقع الخريطة"
          dir="ltr"
          hint="مطلوب للمناطق العشوائية (بدون مخطط وقطعة)."
          value={property.locationMapUrl}
          error={fieldErrors.locationMapUrl}
          onChange={(v) => onPatch("locationMapUrl", v)}
        />
      </FormRow>
    </InfathSection>

    <InfathSection title="المالك والمحكمة">
      <FormRow>
      <RegField
        id="owner_name_bourse"
        label="اسم المالك"
        required
        value={property.ownerName}
        error={fieldErrors.ownerName}
        onChange={(v) => onPatch("ownerName", v)}
      />
      {showCourt ? (
        <CourtCircuitSelects
          courtId="court_bourse"
          circuitId="circuit_bourse"
          court={property.court}
          circuit={property.circuit}
          propertyCourtId={property.courtId}
          propertyCircuitId={property.circuitId}
          fieldErrors={fieldErrors}
          onPatch={onPatch}
        />
      ) : null}
      </FormRow>
    </InfathSection>
    </div>
  );
}
