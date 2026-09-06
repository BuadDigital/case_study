"use client";

/** Enfath form — deed / real-estate-registration sections (identifier, mandate, plan, owner/court). */

import { RegField } from "@platform/app-shared/registration/FormFields";
import { FormRow, InfathSection, Input } from "@platform/ui-kit";
import { CourtCircuitSelects } from "./CourtCircuitSelects";
import {
  requestNumberMatchesDeed,
  type EnfathSectionProps,
} from "./po-property-enfath-form-state";

function EnfathRequestNumberField({
  property,
  fieldErrors,
  onPatch,
  showRequestNumber,
  hasRequestNumber,
}: EnfathSectionProps & {
  showRequestNumber: boolean;
  hasRequestNumber: boolean;
}) {
  if (!showRequestNumber) {
    return (
      <p className="m-0 text-[10px] text-text-3">
        رقم الطلب: لا ينطبق على إسناد المحاكم.
      </p>
    );
  }
  return (
    <>
      <label
        htmlFor="has_request_number"
        className="mb-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-text-2"
      >
        <input
          id="has_request_number"
          type="checkbox"
          className="size-3.5 accent-[var(--color-primary)]"
          checked={hasRequestNumber}
          onChange={(e) => {
            const checked = e.target.checked;
            onPatch("hasRequestNumber", checked);
            if (!checked) onPatch("requestNumber", "");
          }}
        />
        <span>
          رقم الطلب
          {hasRequestNumber ? (
            <span className="text-danger-text"> *</span>
          ) : null}
        </span>
      </label>
      {hasRequestNumber ? (
        <>
          <Input
            id="request_number"
            dir="ltr"
            hasError={Boolean(fieldErrors.requestNumber)}
            value={property.requestNumber}
            onChange={(e) => onPatch("requestNumber", e.target.value)}
            aria-invalid={Boolean(fieldErrors.requestNumber)}
            aria-describedby={
              fieldErrors.requestNumber
                ? "request_number-error"
                : undefined
            }
          />
          {fieldErrors.requestNumber ? (
            <p
              id="request_number-error"
              className="mt-1 text-[10px] text-danger-text"
              role="alert"
            >
              {fieldErrors.requestNumber}
            </p>
          ) : null}
          {/* Q-11: literal match is a soft warning, not a hard block — submitter confirms and proceeds */}
          {requestNumberMatchesDeed(property.requestNumber, property.deedNumber) ? (
            <p className="mt-1 text-[10px] text-amber-text" role="status">
              تأكد من الإدخال: رقم الطلب يطابق رقم الصك حرفياً — التطابق وارد
              مصادفة، أكمل إن كان صحيحاً
            </p>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-[10px] text-text-3">
          لا يوجد رقم طلب — يمكن تجاوز الحقل
        </p>
      )}
    </>
  );
}

export function PoPropertyEnfathDeedSections({
  property,
  fieldErrors,
  onPatch,
  showCourt,
  showRequestNumber,
  hasRealEstateReg,
  hasRequestNumber,
  onDeedNumberChange,
  onRealEstateRegNumberChange,
}: EnfathSectionProps & {
  showCourt: boolean;
  showRequestNumber: boolean;
  hasRealEstateReg: boolean;
  hasRequestNumber: boolean;
  onDeedNumberChange: (value: string) => void;
  onRealEstateRegNumberChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
    <InfathSection title="معرّف العقار">
      <p className="mb-2.5 mt-0 text-[11.5px] leading-relaxed text-text-3">
        أدخل رقم الصك أو رقم التسجيل العيني — أحدهما إلزامي.
      </p>
      <FormRow>
      <RegField
        id="deed_number"
        label="رقم الصك"
        dir="ltr"
        inputMode="numeric"
        value={property.deedNumber}
        error={fieldErrors.deedNumber}
        onChange={onDeedNumberChange}
      />
      <RegField
        id="deed_date"
        label="تاريخ الصك"
        type="date"
        hint="اختياري"
        value={property.deedDate}
        error={fieldErrors.deedDate}
        onChange={(v) => onPatch("deedDate", v)}
      />
      <RegField
        id="real_estate_reg_number"
        label="رقم التسجيل العيني"
        dir="ltr"
        inputMode="numeric"
        hint="تعبئته تُغني عن استعلام البورصة."
        value={property.realEstateRegNumber}
        error={fieldErrors.realEstateRegNumber}
        onChange={onRealEstateRegNumberChange}
      />
      <RegField
        id="real_estate_reg_date"
        label="تاريخ التسجيل العيني"
        required={hasRealEstateReg}
        type="date"
        value={property.realEstateRegDate}
        error={fieldErrors.realEstateRegDate}
        onChange={(v) => onPatch("realEstateRegDate", v)}
      />
      </FormRow>
    </InfathSection>

    <InfathSection title="التكليف">
      <FormRow>
      <RegField
        id="assignment_mandate_number"
        label="رقم التكليف"
        required
        dir="ltr"
        value={property.assignmentMandateNumber}
        error={fieldErrors.assignmentMandateNumber}
        onChange={(v) => onPatch("assignmentMandateNumber", v)}
      />
      <RegField
        id="assignment_mandate_date"
        label="تاريخ التكليف"
        required
        type="date"
        value={property.assignmentMandateDate}
        error={fieldErrors.assignmentMandateDate}
        onChange={(v) => onPatch("assignmentMandateDate", v)}
      />
      <div className="w-full">
        <EnfathRequestNumberField
          property={property}
          fieldErrors={fieldErrors}
          onPatch={onPatch}
          showRequestNumber={showRequestNumber}
          hasRequestNumber={hasRequestNumber}
        />
      </div>
      </FormRow>
    </InfathSection>

    <InfathSection title="بيانات المخطط والموقع">
      <FormRow>
        <RegField
          id="plan_number"
          label="رقم المخطط"
          dir="ltr"
          value={property.planNumber}
          error={fieldErrors.planNumber}
          onChange={(v) => onPatch("planNumber", v)}
        />
        <RegField
          id="plot_number"
          label="رقم القطعة"
          dir="ltr"
          value={property.plotNumber}
          error={fieldErrors.plotNumber}
          onChange={(v) => onPatch("plotNumber", v)}
        />
        <RegField
          id="plan_name"
          label="اسم المخطط"
          value={property.planName}
          error={fieldErrors.planName}
          onChange={(v) => onPatch("planName", v)}
        />
        <RegField
          id="block_number"
          label="رقم البلك"
          dir="ltr"
          value={property.blockNumber}
          error={fieldErrors.blockNumber}
          onChange={(v) => onPatch("blockNumber", v)}
        />
        <RegField
          id="partition_minutes_number_deed"
          label="محضر التجزئة (رقم)"
          dir="ltr"
          value={property.partitionMinutesNumber}
          onChange={(v) => onPatch("partitionMinutesNumber", v)}
        />
        <RegField
          id="partition_minutes_date_deed"
          label="محضر التجزئة (تاريخ)"
          type="date"
          dir="ltr"
          value={property.partitionMinutesDate}
          onChange={(v) => onPatch("partitionMinutesDate", v)}
        />
        <RegField
          id="location_map_url"
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
        id="owner_name"
        label="اسم المالك"
        required
        value={property.ownerName}
        error={fieldErrors.ownerName}
        onChange={(v) => onPatch("ownerName", v)}
      />
      {showCourt ? (
        <CourtCircuitSelects
          courtId="court"
          circuitId="circuit"
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
