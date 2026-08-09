/**
 * DOM target ids for PO property/header validation errors.
 * Pair with `@platform/app-shared/form-ux` scheduleScrollToFormField.
 */

import type { FieldErrors } from "@platform/app-shared/domain/form/field-errors";
import {
  resolveFirstErrorMessage,
  resolveFirstErrorTarget,
  scheduleScrollToFormField,
  type FormErrorTarget,
} from "@platform/app-shared/form-ux";
import {
  isBourseInquiryIdentifier,
  type PoPropertyIntake,
} from "../../prototype/po-intake-data";

/** Top→bottom order for property edit / task work forms. */
export const PO_PROPERTY_ERROR_KEY_ORDER = [
  "deedNumber",
  "realEstateRegNumber",
  "realEstateRegDate",
  "realEstateRegFileName",
  "requestNumber",
  "assignmentMandateNumber",
  "assignmentMandateDate",
  "deedDate",
  "ownerName",
  "court",
  "circuit",
  "planNumber",
  "plotNumber",
  "locationMapUrl",
  "region",
  "city",
  "district",
  "restrictionsPresent",
  "restrictionType",
  "restrictionOtherReason",
  "boundariesAvailability",
  "boundariesExternalDocName",
  "delegationLetterFileNames",
  "assignmentDocFileNames",
  "_contacts",
] as const;

export function poPropertyErrorTargetId(
  key: string,
  prop: Pick<PoPropertyIntake, "id" | "identifierType">,
): string | null {
  const isBourse = isBourseInquiryIdentifier(prop.identifierType);

  if (key.startsWith("contact_phone_")) {
    return `po_contact_phone_${key.slice("contact_phone_".length)}`;
  }
  if (key.startsWith("contact_role_")) {
    return `po_contact_role_${key.slice("contact_role_".length)}`;
  }
  if (key.startsWith("contact_name_")) {
    return `po_contact_name_${key.slice("contact_name_".length)}`;
  }
  if (key === "_contacts") {
    return "po_contacts_section";
  }

  switch (key) {
    case "deedNumber":
      return isBourse ? "deed_number_bourse" : "deed_number";
    case "requestNumber":
      return isBourse ? "request_number_bourse" : "request_number";
    case "deedDate":
      return isBourse ? "deed_date_bourse" : "deed_date";
    case "ownerName":
      return isBourse ? "owner_name_bourse" : "owner_name";
    case "court":
      return isBourse ? "court_bourse" : "court";
    case "circuit":
      return isBourse ? "circuit_bourse" : "circuit";
    case "realEstateRegNumber":
      return "real_estate_reg_number";
    case "realEstateRegDate":
      return "real_estate_reg_date";
    case "realEstateRegFileName":
      return `real_estate_reg_${prop.id}`;
    case "assignmentMandateNumber":
      return isBourse
        ? "assignment_mandate_number_bourse"
        : "assignment_mandate_number";
    case "assignmentMandateDate":
      return isBourse
        ? "assignment_mandate_date_bourse"
        : "assignment_mandate_date";
    case "delegationLetterFileNames":
      return `delegation_${prop.id}`;
    case "assignmentDocFileNames":
      return `assignment_doc_${prop.id}`;
    case "planNumber":
      return isBourse ? "plan_number_bourse" : "plan_number";
    case "plotNumber":
      return isBourse ? "plot_number_bourse" : "plot_number";
    case "locationMapUrl":
      return isBourse ? "location_map_url_bourse" : "location_map_url";
    case "region":
      return "region";
    case "city":
      return "city";
    case "district":
      return "district";
    case "restrictionsPresent":
      return "restrictions_present";
    case "restrictionType":
      return "restriction_type";
    case "restrictionOtherReason":
      return "restriction_other_reason";
    case "boundariesAvailability":
      return "boundaries_availability";
    case "boundariesExternalDocName":
      return "boundaries_external";
    default:
      return null;
  }
}

export function firstPoPropertyErrorTarget(
  errors: FieldErrors,
  prop: Pick<PoPropertyIntake, "id" | "identifierType">,
): string | null {
  const targets: FormErrorTarget[] = [];
  for (const key of PO_PROPERTY_ERROR_KEY_ORDER) {
    if (errors[key]?.trim()) {
      const targetId = poPropertyErrorTargetId(key, prop);
      if (targetId) targets.push({ key, targetId });
    }
  }
  for (const key of Object.keys(errors)) {
    if (!errors[key]?.trim()) continue;
    if (targets.some((t) => t.key === key)) continue;
    const targetId = poPropertyErrorTargetId(key, prop);
    if (targetId) targets.push({ key, targetId });
  }
  return resolveFirstErrorTarget(errors, targets);
}

export function scheduleScrollToFirstPoPropertyError(
  errors: FieldErrors,
  prop: Pick<PoPropertyIntake, "id" | "identifierType">,
  delayMs = 60,
): void {
  scheduleScrollToFormField(firstPoPropertyErrorTarget(errors, prop), delayMs);
}

/** PO header — modal intake uses `*_modal` ids; header edit uses `*_edit`. */
export type PoHeaderFieldIdMap = {
  poNumber?: string;
  promulgationDate: string;
  assignmentType: string;
  assignmentSpecialist?: string;
  assignmentSpecialistEmail: string;
  expectedPropertyCount: string;
};

export const PO_HEADER_MODAL_FIELD_IDS: PoHeaderFieldIdMap = {
  poNumber: "po_number_modal",
  promulgationDate: "promulgation_date_modal",
  assignmentType: "assignment_primary",
  assignmentSpecialist: "po_specialist_modal",
  assignmentSpecialistEmail: "po_specialist_email_modal",
  expectedPropertyCount: "expected_property_count_modal",
};

export const PO_HEADER_EDIT_FIELD_IDS: PoHeaderFieldIdMap = {
  promulgationDate: "promulgation_edit",
  assignmentType: "assignment_primary",
  assignmentSpecialist: "po_specialist_edit",
  assignmentSpecialistEmail: "po_specialist_email_edit",
  expectedPropertyCount: "expected_property_count_edit",
};

const HEADER_KEY_ORDER = [
  "poNumber",
  "promulgationDate",
  "assignmentType",
  "assignmentSpecialist",
  "assignmentSpecialistEmail",
  "expectedPropertyCount",
] as const;

export function firstPoHeaderErrorTarget(
  errors: FieldErrors,
  ids: PoHeaderFieldIdMap,
): string | null {
  const targets: FormErrorTarget[] = [];
  for (const key of HEADER_KEY_ORDER) {
    if (!errors[key]?.trim()) continue;
    const targetId = ids[key];
    if (targetId) targets.push({ key, targetId });
  }
  return resolveFirstErrorTarget(errors, targets);
}

export function scheduleScrollToFirstPoHeaderError(
  errors: FieldErrors,
  ids: PoHeaderFieldIdMap,
  delayMs = 60,
): void {
  scheduleScrollToFormField(firstPoHeaderErrorTarget(errors, ids), delayMs);
}

export function firstPoHeaderErrorMessage(errors: FieldErrors): string {
  return (
    resolveFirstErrorMessage(errors, HEADER_KEY_ORDER) ??
    "يرجى تعبئة بيانات أمر العمل"
  );
}
