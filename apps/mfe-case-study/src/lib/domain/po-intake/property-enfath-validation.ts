import {
  isBourseInquiryIdentifier,
  requiresContacts,
  requiresRequestNumberField,
  showsCourtFields,
  validatePropertyIdentifierNumber,
  type AssignmentType,
  type PoPropertyIntake,
} from "../../app-data/po-intake-data";
import {
  collectRequiredErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/domain/form/field-errors";
import { validatePropertyContacts } from "./property-validation";

function validateDeedOrRealEstateReg(p: PoPropertyIntake, errors: FieldErrors) {
  const hasDeed = p.deedNumber.trim().length > 0;
  const hasReg = p.realEstateRegNumber.trim().length > 0;

  // At least one required: deed number or title registry (or both).
  // A filled title registry skips bourse inquiry.
  if (!hasDeed && !hasReg) {
    const msg = "أدخل رقم الصك أو رقم التسجيل العيني";
    errors.deedNumber = msg;
    errors.realEstateRegNumber = msg;
    return;
  }

  if (hasDeed) {
    const deedError = validatePropertyIdentifierNumber("deed", p.deedNumber);
    if (deedError) errors.deedNumber = deedError;
  }

  if (hasReg) {
    const regError = validatePropertyIdentifierNumber(
      "real_estate_reg",
      p.realEstateRegNumber,
    );
    if (regError) errors.realEstateRegNumber = regError;
    if (!p.realEstateRegDate.trim()) {
      errors.realEstateRegDate = "تاريخ التسجيل العيني مطلوب";
    }
    if (!p.realEstateRegFileName.trim()) {
      errors.realEstateRegFileName =
        "ارفع السجل العقاري كمرفق (يُطلب من أطراف التنفيذ)";
    }
  }
}

export function validatePropertyEnfathFields(
  p: PoPropertyIntake,
  assignmentType: AssignmentType,
): FieldErrors {
  const needCourt = showsCourtFields(assignmentType);
  const needRequest =
    requiresRequestNumberField(assignmentType) && p.hasRequestNumber !== false;

  if (isBourseInquiryIdentifier(p.identifierType)) {
    const requiredKeys = [
      "deedNumber",
      "assignmentMandateNumber",
      "assignmentMandateDate",
      "deedDate",
      "ownerName",
      ...(needCourt ? (["court", "circuit"] as const) : []),
      ...(needRequest ? (["requestNumber"] as const) : []),
    ];
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
        [...requiredKeys],
      ),
    );
    if (p.assignmentDocFileNames.length === 0) {
      errors.assignmentDocFileNames = "خطاب الإسناد مطلوب";
    }
    const identifierError = validatePropertyIdentifierNumber(
      p.identifierType,
      p.deedNumber,
    );
    if (identifierError) errors.deedNumber = identifierError;
    return errors;
  }

  const requiredKeys = [
    "assignmentMandateNumber",
    "assignmentMandateDate",
    "ownerName",
    ...(needCourt ? (["court", "circuit"] as const) : []),
    ...(needRequest ? (["requestNumber"] as const) : []),
  ];

  const errors = mergeFieldErrors(
    collectRequiredErrors(
      {
        requestNumber: p.requestNumber,
        assignmentMandateNumber: p.assignmentMandateNumber,
        assignmentMandateDate: p.assignmentMandateDate,
        ownerName: p.ownerName,
        court: p.court,
        circuit: p.circuit,
      },
      [...requiredKeys],
    ),
  );

  if (p.delegationLetterFileNames.length === 0) {
    errors.delegationLetterFileNames = "خطاب التفويض مطلوب";
  }

  validateDeedOrRealEstateReg(p, errors);

  if (p.assignmentDocFileNames.length === 0) {
    errors.assignmentDocFileNames = "خطاب الإسناد مطلوب";
  }

  return errors;
}

export function mergePropertyEnfathValidation(
  p: PoPropertyIntake,
  assignmentType: AssignmentType,
): FieldErrors {
  return mergeFieldErrors(
    validatePropertyEnfathFields(p, assignmentType),
    validatePropertyContacts(p, {
      requireAtLeastOne: requiresContacts(assignmentType),
    }),
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
    errors.realEstateRegNumber ??
    errors.requestNumber ??
    errors.assignmentMandateNumber ??
    errors.assignmentMandateDate ??
    errors.deedDate ??
    errors.realEstateRegDate ??
    errors.ownerName ??
    errors.court ??
    errors.circuit ??
    errors.district ??
    errors.delegationLetterFileNames ??
    errors.realEstateRegFileName ??
    errors.assignmentDocFileNames ??
    (contactPhoneKey ? errors[contactPhoneKey] : undefined) ??
    (contactRoleKey ? errors[contactRoleKey] : undefined) ??
    (contactNameKey ? errors[contactNameKey] : undefined) ??
    "يرجى تعبئة بيانات العقار"
  );
}

export { isValidContactEntry } from "./property-validation";
