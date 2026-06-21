import type { PoPropertyIntake } from "../../prototype/po-intake-data";
import {
  collectRequiredErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/domain/form/field-errors";

const RESTRICTIONS_VALUES = new Set(["yes", "no"]);
const BOUNDARIES_VALUES = new Set(["deed", "bourse", "doc", "no"]);

export function validatePropertyBourseFields(
  p: PoPropertyIntake,
): FieldErrors {
  const errors = mergeFieldErrors(
    collectRequiredErrors(
      {
        city: p.city,
        district: p.district,
        classification: p.classification,
        propertyType: p.propertyType,
      },
      ["city", "district", "classification", "propertyType"],
    ),
  );

  const restrictions = p.restrictionsPresent.trim().toLowerCase();
  if (restrictions && !RESTRICTIONS_VALUES.has(restrictions)) {
    errors.restrictionsPresent = "قيمة القيود غير صالحة";
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
    errors.classification ??
    errors.propertyType ??
    errors.restrictionsPresent ??
    errors.boundariesAvailability ??
    errors.boundariesExternalDocName ??
    errors._ ??
    "يرجى تعبئة بيانات البورصة"
  );
}
