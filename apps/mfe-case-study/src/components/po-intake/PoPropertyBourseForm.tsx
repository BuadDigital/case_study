"use client";

import {
  BOUNDARIES_AVAILABILITY_OPTIONS,
  BOURSE_DEED_VITALITY_ACTIVE,
  BOURSE_DEED_VITALITY_INACTIVE,
  BOURSE_OBSTRUCTION_LABEL,
  DEED_STATUS_OPTIONS,
  RESTRICTIONS_PRESENT_OPTIONS,
  RESTRICTION_TYPE_OPTIONS,
  boundariesDetailFieldsOptional,
  boundariesMarkedUnavailable,
  clearPropertyBoundaryFields,
  hasRestrictionType,
  toggleRestrictionType,
  type BourseDeedVitality,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { PoPropertyBoundariesEntrySection } from "./PoPropertyBoundariesEntrySection";
import { RegionCitySelects } from "./RegionCitySelects";
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
          بيانات البورصة — المدينة والحي والمساحة والحدود حسب استعلام البورصة.
        </Note>
      ) : null}

      {!obstructionPath ? (
        <FormRow>
          <RegionCitySelects
            property={property}
            fieldErrors={fieldErrors}
            onPatch={onPatch}
          />
          <RegField
            id="area"
            label="المساحة"
            value={property.area}
            onChange={(v) => onPatch("area", v)}
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
          <div
            id="restrictions_present"
            className={cn(
              "mt-3 w-full rounded-lg p-1",
              fieldErrors.restrictionsPresent &&
                "border border-danger bg-danger-bg/40 ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
            )}
          >
            <Label className="mb-1 text-[11px]">القيود على العقار</Label>
            <div className="flex flex-wrap gap-1.5">
              {RESTRICTIONS_PRESENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={pillClass(property.restrictionsPresent === opt.value)}
                  onClick={() => {
                    onPatch("restrictionsPresent", opt.value);
                    if (opt.value !== "yes") {
                      onPatch("restrictionType", "");
                      onPatch("restrictionOtherReason", "");
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fieldErrors.restrictionsPresent ? (
              <p className="mt-1 text-[10px] text-danger-text" role="alert">
                {fieldErrors.restrictionsPresent}
              </p>
            ) : null}
            {property.restrictionsPresent === "yes" ? (
              <div
                id="restriction_type"
                className={cn(
                  "mt-3 space-y-3 rounded-lg p-1",
                  fieldErrors.restrictionType &&
                    "border border-danger bg-danger-bg/40 ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
                )}
              >
                <div>
                  <Label className="mb-1 text-[11px]">
                    نوع القيد <span className="text-danger-text">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {RESTRICTION_TYPE_OPTIONS.map((opt) => {
                      const selected = hasRestrictionType(
                        property.restrictionType,
                        opt.value,
                      );
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={pillClass(selected)}
                          onClick={() => {
                            const next = toggleRestrictionType(
                              property.restrictionType,
                              opt.value,
                            );
                            onPatch("restrictionType", next);
                            if (!hasRestrictionType(next, "other")) {
                              onPatch("restrictionOtherReason", "");
                            }
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.restrictionType ? (
                    <p className="mt-1 text-[10px] text-danger-text" role="alert">
                      {fieldErrors.restrictionType}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-text-3">
                      يمكن اختيار أكثر من نوع
                    </p>
                  )}
                </div>
                {hasRestrictionType(property.restrictionType, "other") ? (
                  <RegField
                    id="restriction_other_reason"
                    label="سبب القيد"
                    required
                    value={property.restrictionOtherReason}
                    error={fieldErrors.restrictionOtherReason}
                    onChange={(v) => onPatch("restrictionOtherReason", v)}
                    placeholder="اذكر سبب القيد…"
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            id="boundaries_availability"
            className={cn(
              "mt-3 w-full rounded-lg p-1",
              fieldErrors.boundariesAvailability &&
                "border border-danger bg-danger-bg/40 ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
            )}
          >
            <Label className="mb-1 text-[11px]">توفر الحدود</Label>
            <div className="flex flex-wrap gap-1.5">
              {BOUNDARIES_AVAILABILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={pillClass(
                    property.boundariesAvailability === opt.value,
                  )}
                  onClick={() => {
                    onPatch("boundariesAvailability", opt.value);
                    if (opt.value === "no") {
                      onPatch("boundariesExternalDocName", "");
                      const cleared = clearPropertyBoundaryFields();
                      (
                        Object.entries(cleared) as [
                          keyof PoPropertyIntake,
                          string,
                        ][]
                      ).forEach(([key, value]) => onPatch(key, value));
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {boundariesMarkedUnavailable(property.boundariesAvailability) ? (
              <Note tone="default" className="mt-3 border border-border bg-surface-2">
                الحدود <strong>غير متوفرة</strong> — لا يُطلب إدخال تفاصيل الحدود
                ويمكن الحفظ مباشرة.
              </Note>
            ) : boundariesDetailFieldsOptional(
                property.boundariesAvailability,
              ) ? (
              <Note tone="info" className="mt-3">
                عند اختيار مصدر للحدود، الحقول التفصيلية{" "}
                <strong>اختيارية</strong> ولا تمنع «حفظ وإكمال البورصة».
              </Note>
            ) : null}
            {property.boundariesAvailability === "doc" ? (
              <div className="mt-3">
                <RegField
                  id="boundaries_external"
                  label="اسم المستند الخارجي (اختياري)"
                  value={property.boundariesExternalDocName}
                  error={fieldErrors.boundariesExternalDocName}
                  onChange={(v) => onPatch("boundariesExternalDocName", v)}
                />
              </div>
            ) : null}
            {boundariesDetailFieldsOptional(property.boundariesAvailability) ? (
              <PoPropertyBoundariesEntrySection
                property={property}
                fieldErrors={fieldErrors}
                onPatch={onPatch}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
