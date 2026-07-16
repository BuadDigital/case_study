import type { PoPropertyIntake } from "../../prototype/po-intake-data";
import {
  collectRequiredErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/domain/form/field-errors";

const RESTRICTIONS_VALUES = new Set(["yes", "no"]);
const RESTRICTION_TYPE_VALUES = new Set([
  "mortgaged",
  "seized",
  "suspended",
  "other",
]);
const BOUNDARIES_VALUES = new Set(["deed", "bourse", "doc", "no"]);

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

  const restrictions = p.restrictionsPresent.trim().toLowerCase();
  if (restrictions && !RESTRICTIONS_VALUES.has(restrictions)) {
    errors.restrictionsPresent = "قيمة القيود غير صالحة";
  }

  if (restrictions === "yes") {
    const type = p.restrictionType.trim().toLowerCase();
    if (!RESTRICTION_TYPE_VALUES.has(type)) {
      errors.restrictionType = "نوع القيد مطلوب";
    } else if (type === "other" && !p.restrictionOtherReason.trim()) {
      errors.restrictionOtherReason = "سبب القيد مطلوب عند اختيار أخرى";
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
    errors.restrictionsPresent ??
    errors.restrictionType ??
    errors.restrictionOtherReason ??
    errors.boundariesAvailability ??
    errors.boundariesExternalDocName ??
    errors._ ??
    "يرجى تعبئة بيانات البورصة"
  );
}
