"use client";

/** Enfath form — deed / real-estate-registration sections (identifier, mandate, plan, owner/court). */

import { RegField } from "@platform/app-shared/registration/FormFields";
import { FormFlowGrid, FormRow, InfathSection, Input } from "@platform/ui-kit";
import { CourtCircuitSelects } from "./CourtCircuitSelects";
import {
  DEFAULT_CLIENT_FIELD_POLICY,
  type ClientFieldPolicy,
} from "../../lib/app-data/po-intake-data";
import {
  requestNumberMatchesDeed,
  type EnfathSectionProps,
} from "./po-property-deed-form-state";

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
  if (!showRequestNumber) return null;
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
          {/* Literal match is a soft warning, not a hard block — submitter confirms and proceeds */}
          {requestNumberMatchesDeed(property.requestNumber, property.deedNumber) ? (
            <p className="mt-1 text-[10px] text-amber-text" role="status">
              رقم الطلب ورقم الصك متطابقان. هل كتبت الرقم نفسه في الخانتين عن غير قصد؟
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
  fieldPolicy = DEFAULT_CLIENT_FIELD_POLICY,
}: EnfathSectionProps & {
  showCourt: boolean;
  showRequestNumber: boolean;
  hasRealEstateReg: boolean;
  hasRequestNumber: boolean;
  onDeedNumberChange: (value: string) => void;
  onRealEstateRegNumberChange: (value: string) => void;
  fieldPolicy?: ClientFieldPolicy;
}) {
  return (
    <FormFlowGrid>
    {/* Omar 2026-11-10: the group titles and the identifier hint are gone from the form — the field
        labels say enough; the titles stay for screen readers. */}
    <InfathSection title="معرّف العقار" hideTitle>
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

    <InfathSection title="التكليف" hideTitle>
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
      <div className="w-full empty:hidden">
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

    <InfathSection title="بيانات المخطط والموقع" hideTitle>
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

    {fieldPolicy.requiresOwnerName || showCourt ? (
    <InfathSection title="المالك والمحكمة" hideTitle>
      <FormRow>
      {fieldPolicy.requiresOwnerName ? (
        <div className="min-w-0">
          <RegField
            id="owner_name"
            label="اسم المالك"
            required
            value={property.ownerName}
            error={fieldErrors.ownerName}
            onChange={(v) => onPatch("ownerName", v)}
          />
          {/* Omar 2026-11-10: the staff know whether the deed is shared — one tick decides «مشاع»;
              the owners count no longer does. */}
          <label
            htmlFor="is_shared_ownership"
            className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-text-2"
          >
            <input
              id="is_shared_ownership"
              type="checkbox"
              className="size-3.5 accent-[var(--color-primary)]"
              checked={property.isSharedOwnership === true}
              onChange={(e) => onPatch("isSharedOwnership", e.target.checked)}
            />
            مشاع
          </label>
        </div>
      ) : null}
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
    ) : null}
    </FormFlowGrid>
  );
}
