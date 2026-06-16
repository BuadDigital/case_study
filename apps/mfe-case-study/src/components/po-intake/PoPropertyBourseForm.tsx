"use client";

import { useMemo } from "react";
import {
  BOUNDARIES_AVAILABILITY_OPTIONS,
  BOURSE_DEED_VITALITY_ACTIVE,
  BOURSE_DEED_VITALITY_INACTIVE,
  BOURSE_OBSTRUCTION_LABEL,
  CITY_OPTIONS,
  CLASSIFICATION_OPTIONS,
  DEED_STATUS_OPTIONS,
  PROPERTY_CLASSIFICATIONS,
  RESTRICTIONS_PRESENT_OPTIONS,
  type BourseDeedVitality,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { cn, FormRow, Label, Note } from "@platform/design-system";

type Props = {
  property: PoPropertyIntake;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
  showIntroNote?: boolean;
  /** مسار الصك فعال / غير فعال → متعذر (استعلام البورصة ومهام الأخصائي). */
  showDeedVitalityFlow?: boolean;
  deedVitality?: BourseDeedVitality | null;
  onDeedVitalityChange?: (value: BourseDeedVitality) => void;
  obstructionReason?: string;
  onObstructionReasonChange?: (value: string) => void;
  obstructionReasonError?: string;
};

const pillClass = (selected: boolean) =>
  cn(
    "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-DEFAULT)] border-2 px-4 py-2 font-[inherit] text-xs font-semibold transition-all",
    selected
      ? "border-primary bg-primary text-white shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
      : "border-border bg-surface text-text-2 hover:border-primary-light hover:text-primary",
  );

export function PoPropertyBourseForm({
  property,
  fieldErrors,
  onPatch,
  showIntroNote = true,
  showDeedVitalityFlow = false,
  deedVitality = null,
  onDeedVitalityChange,
  obstructionReason = "",
  onObstructionReasonChange,
  obstructionReasonError,
}: Props) {
  const obstructionPath = showDeedVitalityFlow && deedVitality === "inactive";
  const propertyTypes = useMemo(() => {
    const c = property.classification;
    return c ? (PROPERTY_CLASSIFICATIONS[c] ?? []) : [];
  }, [property.classification]);

  return (
    <>
      {showDeedVitalityFlow ? (
        <div className="col-span-full w-full">
          <Label className="mb-1 text-[11px]">
            حالة الصك <span className="text-danger-text">*</span>
          </Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={pillClass(deedVitality === "active")}
              onClick={() => {
                onDeedVitalityChange?.("active");
                onPatch("deedStatus", "فعال");
              }}
            >
              {BOURSE_DEED_VITALITY_ACTIVE}
            </button>
            <button
              type="button"
              className={pillClass(deedVitality === "inactive")}
              onClick={() => onDeedVitalityChange?.("inactive")}
            >
              {BOURSE_DEED_VITALITY_INACTIVE}
            </button>
          </div>
        </div>
      ) : null}

      {obstructionPath ? (
        <div className="col-span-full w-full">
          <Note tone="warn" className="mb-3">
            الصك غير فعال — سجّل التعذر وسببه ليُراجعه المشرف في{" "}
            <strong>إدارة التعذرات</strong>.
          </Note>
          <div className="mb-3 w-full">
            <Label className="mb-1 text-[11px]">نوع الإجراء</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={pillClass(true)}>
                {BOURSE_OBSTRUCTION_LABEL}
              </button>
            </div>
          </div>
          <RegField
            id="obstruction_reason"
            label="سبب التعذر"
            required
            value={obstructionReason}
            error={obstructionReasonError}
            onChange={(v) => onObstructionReasonChange?.(v)}
            placeholder="اذكر سبب عدم إكمال بيانات البورصة…"
          />
        </div>
      ) : null}

      {showIntroNote && !obstructionPath ? (
        <Note tone="info" className="mb-3">
          بيانات البورصة — التصنيف ونوع العقار من القائمة الهرمية المعتمدة في
          النظام (5 تصنيفات / 47 نوعاً).
        </Note>
      ) : null}

      {!obstructionPath ? (
        <FormRow>
          <RegSelect
            id="city"
            label="المدينة"
            required
            options={[...CITY_OPTIONS]}
            value={property.city}
            error={fieldErrors.city}
            onChange={(v) => onPatch("city", v)}
          />
          <RegField
            id="district"
            label="الحي"
            required
            value={property.district}
            error={fieldErrors.district}
            onChange={(v) => onPatch("district", v)}
          />
          <RegSelect
            id="classification"
            label="التصنيف"
            required
            options={CLASSIFICATION_OPTIONS}
            value={property.classification}
            error={fieldErrors.classification}
            onChange={(v) => {
              onPatch("classification", v);
              onPatch("propertyType", "");
            }}
          />
          <RegSelect
            id="property_type"
            label="نوع العقار"
            required
            options={propertyTypes}
            value={property.classification ? property.propertyType : ""}
            error={fieldErrors.propertyType}
            disabled={!property.classification}
            placeholder={
              property.classification
                ? "اختر نوع العقار..."
                : "اختر التصنيف أولاً"
            }
            onChange={(v) => onPatch("propertyType", v)}
          />
          <RegField
            id="area"
            label="المساحة"
            value={property.area}
            onChange={(v) => onPatch("area", v)}
          />
          <RegField
            id="build_license"
            label="رقم رخصة البناء"
            value={property.buildLicenseNumber}
            onChange={(v) => onPatch("buildLicenseNumber", v)}
          />
          <RegField
            id="subdivision_record"
            label="رقم محضر التجزئة"
            value={property.subdivisionRecordNumber}
            onChange={(v) => onPatch("subdivisionRecordNumber", v)}
          />
          {showDeedVitalityFlow ? null : (
            <RegSelect
              id="deed_status"
              label="حالة الصك"
              options={[...DEED_STATUS_OPTIONS]}
              value={property.deedStatus}
              onChange={(v) => onPatch("deedStatus", v)}
            />
          )}
        </FormRow>
      ) : null}

      {!obstructionPath ? (
        <>
          <div className="mt-3 w-full">
            <Label className="mb-1 text-[11px]">القيود على العقار</Label>
            <div className="flex flex-wrap gap-1.5">
              {RESTRICTIONS_PRESENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={pillClass(property.restrictionsPresent === opt.value)}
                  onClick={() => onPatch("restrictionsPresent", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 w-full">
            <Label className="mb-1 text-[11px]">توفر الحدود</Label>
            <div className="flex flex-wrap gap-1.5">
              {BOUNDARIES_AVAILABILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={pillClass(
                    property.boundariesAvailability === opt.value,
                  )}
                  onClick={() => onPatch("boundariesAvailability", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {property.boundariesAvailability === "doc" ? (
              <div className="mt-3">
                <RegField
                  id="boundaries_external"
                  label="اسم المستند الخارجي"
                  required
                  value={property.boundariesExternalDocName}
                  error={fieldErrors.boundariesExternalDocName}
                  onChange={(v) => onPatch("boundariesExternalDocName", v)}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
