import type { PoPropertyIntake } from "../../app-data/po-intake-data";
import {
  parseRestrictionTypes,
  propertyHasRegisteredTitle,
} from "../../app-data/po-intake-data";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import {
  collectRequiredErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/domain/form/field-errors";

const RESTRICTIONS_VALUES = new Set(["yes", "no"]);
const BOUNDARIES_VALUES = new Set(["deed", "bourse", "doc", "no"]);

/**
 * The land area is the valuation basis — required to complete the bourse, registered titles
 * included. Same rule and messages as the server (WorkOrderValidator.BourseAreaError).
 */
export function bourseAreaError(area: string | null | undefined): string | null {
  if (!area?.trim()) return "مساحة الأرض مطلوبة لإتمام البورصة";
  const m2 = parseLocaleNumber(area);
  return Number.isFinite(m2) && m2 > 0 ? null : "مساحة الأرض يجب أن تكون رقماً أكبر من صفر";
}

export function validatePropertyBourseFields(
  p: PoPropertyIntake,
): FieldErrors {
  const errors = mergeFieldErrors(
    collectRequiredErrors(
      {
        city: p.city,
        district: p.district,
      },
      ["city", "district"],
    ),
  );

  const areaError = bourseAreaError(p.area);
  if (areaError) errors.area = areaError;

  if (propertyHasRegisteredTitle(p)) return errors;

  if (!p.bourseDeedImageFileName.trim()) {
    errors.bourseDeedImageFileName = "صورة الصك من البورصة مطلوبة";
  }

  const restrictions = p.restrictionsPresent.trim().toLowerCase();
  if (restrictions && !RESTRICTIONS_VALUES.has(restrictions)) {
    errors.restrictionsPresent = "قيمة القيود غير صالحة";
  }

  if (restrictions === "yes") {
    const types = parseRestrictionTypes(p.restrictionType);
    if (types.length === 0) {
      errors.restrictionType = "اختر نوع قيد واحداً على الأقل";
    } else if (types.includes("other") && !p.restrictionOtherReason.trim()) {
      errors.restrictionOtherReason = "سبب القيد مطلوب عند اختيار أخرى";
    }
  } else {
    const raw = p.restrictionType.trim();
    if (raw) {
      const types = parseRestrictionTypes(raw);
      if (types.length === 0) {
        errors.restrictionType = "قيمة نوع القيد غير صالحة";
      }
    }
  }

  const boundaries = p.boundariesAvailability.trim().toLowerCase();
  if (boundaries && !BOUNDARIES_VALUES.has(boundaries)) {
    errors.boundariesAvailability = "قيمة توفر الحدود غير صالحة";
  }

  return errors;
}

export function firstBourseValidationMessage(errors: FieldErrors): string {
  return (
    errors.city ??
    errors.district ??
    errors.area ??
    errors.bourseDeedImageFileName ??
    errors.restrictionsPresent ??
    errors.restrictionType ??
    errors.restrictionOtherReason ??
    errors.boundariesAvailability ??
    errors.boundariesExternalDocName ??
    errors._ ??
    "يرجى تعبئة بيانات البورصة"
  );
}
