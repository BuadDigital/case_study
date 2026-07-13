import {
  isBourseInquiryIdentifier,
  requiresAssignmentDecree,
  validatePropertyIdentifierNumber,
  type AssignmentType,
  type PoPropertyIntake,
} from "../../prototype/po-intake-data";
import {
  collectRequiredErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/domain/form/field-errors";
import { validatePropertyContacts } from "./property-validation";

export function validatePropertyEnfathFields(
  p: PoPropertyIntake,
  assignmentType: AssignmentType,
): FieldErrors {
  if (isBourseInquiryIdentifier(p.identifierType)) {
    const errors = mergeFieldErrors(
      collectRequiredErrors(
        {
          deedNumber: p.deedNumber,
          requestNumber: p.requestNumber,
          assignmentMandateNumber: p.assignmentMandateNumber,
          assignmentMandateDate: p.assignmentMandateDate,
          deedDate: p.deedDate,
          ownerName: p.ownerName,
          court: p.court,
          circuit: p.circuit,
        },
        [
          "deedNumber",
          "requestNumber",
          "assignmentMandateNumber",
          "assignmentMandateDate",
          "deedDate",
          "ownerName",
          "court",
          "circuit",
        ],
      ),
    );
    if (
      requiresAssignmentDecree(assignmentType) &&
      !p.assignmentDocFileName.trim()
    ) {
      errors.assignmentDocFileName =
        "ارفع قرار الإسناد الخاص بهذا العقار (مطلوب لمسار التنفيذ)";
    }
    const identifierError = validatePropertyIdentifierNumber(
      p.identifierType,
      p.deedNumber,
    );
    if (identifierError) errors.deedNumber = identifierError;
    return errors;
  }

  const errors = mergeFieldErrors(
    collectRequiredErrors(
      {
        deedNumber: p.deedNumber,
        requestNumber: p.requestNumber,
        assignmentMandateNumber: p.assignmentMandateNumber,
        assignmentMandateDate: p.assignmentMandateDate,
        deedDate: p.deedDate,
        ownerName: p.ownerName,
        delegationLetterFileName: p.delegationLetterFileName,
      },
      [
        "deedNumber",
        "requestNumber",
        "assignmentMandateNumber",
        "assignmentMandateDate",
        "deedDate",
        "ownerName",
        "delegationLetterFileName",
      ],
    ),
  );

  if (
    p.identifierType === "real_estate_reg" &&
    !p.realEstateRegFileName.trim()
  ) {
    errors.realEstateRegFileName =
      "ارفع السجل العقاري كمرفق (يُطلب من أطراف التنفيذ)";
  }

  if (
    requiresAssignmentDecree(assignmentType) &&
    !p.assignmentDocFileName.trim()
  ) {
    errors.assignmentDocFileName =
      "ارفع قرار الإسناد الخاص بهذا العقار (مطلوب لمسار التنفيذ)";
  }

  const identifierError = validatePropertyIdentifierNumber(
    p.identifierType,
    p.deedNumber,
  );
  if (identifierError) errors.deedNumber = identifierError;

  return errors;
}

export function mergePropertyEnfathValidation(
  p: PoPropertyIntake,
  assignmentType: AssignmentType,
): FieldErrors {
  return mergeFieldErrors(
    validatePropertyEnfathFields(p, assignmentType),
    validatePropertyContacts(p),
  );
}

export function firstEnfathValidationMessage(errors: FieldErrors): string {
  const contactPhoneKey = Object.keys(errors).find((k) =>
    k.startsWith("contact_phone_"),
  );
  const contactRoleKey = Object.keys(errors).find((k) =>
    k.startsWith("contact_role_"),
  );
  const contactNameKey = Object.keys(errors).find((k) =>
    k.startsWith("contact_name_"),
  );

  return (
    errors._contacts ??
    errors._ ??
    errors.deedNumber ??
    errors.requestNumber ??
    errors.assignmentMandateNumber ??
    errors.assignmentMandateDate ??
    errors.deedDate ??
    errors.ownerName ??
    errors.court ??
    errors.circuit ??
    errors.district ??
    errors.classification ??
    errors.propertyType ??
    errors.delegationLetterFileName ??
    errors.realEstateRegFileName ??
    errors.assignmentDocFileName ??
    (contactPhoneKey ? errors[contactPhoneKey] : undefined) ??
    (contactRoleKey ? errors[contactRoleKey] : undefined) ??
    (contactNameKey ? errors[contactNameKey] : undefined) ??
    "يرجى تعبئة بيانات العقار"
  );
}

export function findInvalidEnfathPropertyIndex(
  properties: PoPropertyIntake[],
  assignmentType: AssignmentType,
): { index: number; errors: FieldErrors } | null {
  for (let i = 0; i < properties.length; i++) {
    const errors = mergePropertyEnfathValidation(properties[i], assignmentType);
    if (Object.keys(errors).length > 0) {
      return { index: i, errors };
    }
  }
  return null;
}

export { isValidContactEntry } from "./property-validation";
