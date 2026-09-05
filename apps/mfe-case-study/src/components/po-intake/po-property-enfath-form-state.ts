/**
 * Pure rules behind `PoPropertyEnfathForm`: which sections a fields-mode shows,
 * the stage / prior-deed notices, the prior-deed autofill keys, and the
 * document-name merge after cloning a prior property's attachments.
 * No React, no I/O.
 */
import {
  isBourseInquiryIdentifier,
  requiresContacts,
  requiresRequestNumberField,
  showsCourtFields,
  type AssignmentType,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../../lib/app-data/po-intake-data";
import type { ClonedPropertyDocNames } from "../../lib/app-data/assignment-doc-attachments";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";

export type EnfathFieldsMode = "all" | "identifier-only" | "bourse-inquiry-primary";

export type PoPropertyPatch = <K extends keyof PoPropertyIntake>(
  key: K,
  value: PoPropertyIntake[K],
) => void;

/** Props every enfath section shares. */
export type EnfathSectionProps = {
  property: PoPropertyIntake;
  fieldErrors: FieldErrors;
  onPatch: PoPropertyPatch;
};

export type EnfathFormVisibility = {
  isBourseId: boolean;
  isIdentifierOnly: boolean;
  isPrimaryOnly: boolean;
  /** Extended sections (bourse primary, attachments, contacts). */
  showExtended: boolean;
  showBoursePrimary: boolean;
  showDeedFields: boolean;
  showCourt: boolean;
  showRequestNumber: boolean;
  contactsRequired: boolean;
  hasRealEstateReg: boolean;
  hasRequestNumber: boolean;
  showDelegationDoc: boolean;
  showRegistryDoc: boolean;
  showOtherDocs: boolean;
};

export function enfathFormVisibility(input: {
  fieldsMode: EnfathFieldsMode;
  assignmentType: AssignmentType;
  identifierType: PropertyIdentifierType;
  realEstateRegNumber: string;
  hasRequestNumber: boolean | null | undefined;
}): EnfathFormVisibility {
  const { fieldsMode } = input;
  const isBourseId = isBourseInquiryIdentifier(input.identifierType);
  const isIdentifierOnly = fieldsMode === "identifier-only";
  const isPrimaryOnly = fieldsMode === "bourse-inquiry-primary";
  const showExtended = fieldsMode === "all" || isPrimaryOnly;
  const hasRealEstateReg = input.realEstateRegNumber.trim().length > 0;
  return {
    isBourseId,
    isIdentifierOnly,
    isPrimaryOnly,
    showExtended,
    showBoursePrimary: isBourseId && showExtended,
    showDeedFields: !isBourseId && fieldsMode === "all",
    showCourt: showsCourtFields(input.assignmentType),
    showRequestNumber: requiresRequestNumberField(input.assignmentType),
    contactsRequired: requiresContacts(input.assignmentType),
    hasRealEstateReg,
    hasRequestNumber: input.hasRequestNumber !== false,
    showDelegationDoc: !isBourseId && fieldsMode === "all",
    showRegistryDoc: hasRealEstateReg && fieldsMode === "all",
    showOtherDocs: fieldsMode === "all" || isPrimaryOnly,
  };
}

/** PO the attachments are cached under — current PO first, then the excluded one. */
export function resolveAttachPo(poNumber?: string, excludePoNumber?: string): string {
  return poNumber?.trim() || excludePoNumber?.trim() || "";
}

/** Current PO must never count as a "prior" registration (e.g. after phase revert). */
export function resolvePriorExclusion(input: {
  poNumber?: string;
  excludePoNumber?: string;
  propertyId?: string;
}): { priorExcludePo: string | undefined; priorExcludePropertyId: string | undefined } {
  return {
    priorExcludePo:
      input.excludePoNumber?.trim() || input.poNumber?.trim() || undefined,
    priorExcludePropertyId: input.propertyId?.trim() || undefined,
  };
}

/** Identifier type implied by the entered numbers (fields-mode "all" only). */
export function derivedIdentifierType(realEstateRegNumber: string): PropertyIdentifierType {
  return realEstateRegNumber.trim().length > 0 ? "real_estate_reg" : "deed";
}

export function stageNoteText(isBourseId: boolean, hasRealEstateReg: boolean): string {
  if (isBourseId) {
    return "مسار استعلام البورصة — أدخل البيانات الأولية وبيانات البورصة معاً.";
  }
  if (hasRealEstateReg) {
    return "بيانات مرحلة إنفاذ — مع التسجيل العيني يمكن تجاوز استعلام البورصة.";
  }
  return "بيانات مرحلة إنفاذ — يلزم رقم الصك أو التسجيل العيني (أو كلاهما)؛ بدون تسجيل عيني تُكمّل بيانات البورصة لاحقاً من «استعلام البورصة».";
}

export function contactsSectionTitle(contactsRequired: boolean): string {
  return contactsRequired ? "ضباط الاتصال *" : "ضباط الاتصال (اختياري)";
}

/** The prior-PO notice shows only while a deed number is entered. */
export function priorPoNotice(deedNumber: string, priorPo: string | null): string | null {
  return deedNumber.trim().length > 0 ? priorPo : null;
}

export function priorFillStatusText(priorFilled: boolean): string {
  return priorFilled
    ? "تم نسخ بيانات الدراسة السابقة بالكامل (بما فيها المستندات والـ PDF وخطابات التفويض) كأساس. عدّل ما تغيّر ثم احفظ — النسخة المحفوظة في هذه المعاملة هي المعتمدة؛ الدراسات السابقة تبقى للأرشيف والربط."
    : "جاري جلب ونسخ البيانات والمستندات السابقة…";
}

/** One full auto-fill per propertyId + deed + prior PO (don't fight user edits). */
export function priorApplyKey(propertyId: string, deed: string, hitPo: string): string {
  return `${propertyId}|${deed}|${hitPo}`;
}

/** A hit on the excluded PO is the current transaction itself, not a prior one. */
export function isPriorHitExcluded(
  hitPo: string | null,
  priorExcludePo: string | undefined,
): boolean {
  return Boolean(hitPo && priorExcludePo && hitPo === priorExcludePo);
}

type ClonedDocNameKeys =
  | "assignmentDocFileNames"
  | "delegationLetterFileNames"
  | "otherDocumentFileNames"
  | "realEstateRegFileName"
  | "deedOwnershipFileName"
  | "bourseDeedImageFileName";

/**
 * After cloning attachment bytes from a prior property, prefer the cloned
 * names; fall back to the file-name hints already on the property.
 */
export function mergeClonedDocumentNames<
  T extends Pick<PoPropertyIntake, ClonedDocNameKeys>,
>(next: T, cloned: ClonedPropertyDocNames): T {
  return {
    ...next,
    assignmentDocFileNames:
      cloned.assignmentDocFileNames.length > 0
        ? cloned.assignmentDocFileNames
        : next.assignmentDocFileNames,
    delegationLetterFileNames:
      cloned.delegationLetterFileNames.length > 0
        ? cloned.delegationLetterFileNames
        : next.delegationLetterFileNames,
    otherDocumentFileNames:
      cloned.otherDocumentFileNames.length > 0
        ? cloned.otherDocumentFileNames
        : next.otherDocumentFileNames,
    realEstateRegFileName:
      cloned.realEstateRegFileName || next.realEstateRegFileName,
    deedOwnershipFileName:
      cloned.deedOwnershipFileName || next.deedOwnershipFileName,
    bourseDeedImageFileName:
      cloned.bourseDeedImageFileName || next.bourseDeedImageFileName,
  };
}

/** Field-by-field fallback when no atomic `onReplaceProperty` is available — never the id. */
export function fallbackPatchEntries(
  next: PoPropertyIntake,
): [keyof PoPropertyIntake, PoPropertyIntake[keyof PoPropertyIntake]][] {
  return (Object.keys(next) as (keyof PoPropertyIntake)[])
    .filter((key) => key !== "id")
    .map((key) => [key, next[key]]);
}

/** Q-11: literal match is a soft warning, not a hard block. */
export function requestNumberMatchesDeed(requestNumber: string, deedNumber: string): boolean {
  const request = requestNumber.trim();
  return request.length > 0 && request === deedNumber.trim();
}

export function withoutFileName(names: readonly string[], name: string): string[] {
  return names.filter((n) => n !== name);
}
