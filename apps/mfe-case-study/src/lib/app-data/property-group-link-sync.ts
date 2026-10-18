/**
 * Grouped property (decision 2026-10-15): confirming a link copies the two deeds' data into
 * each other's empty slots, once. The server fills the intake / bourse fields, the contacts
 * and the inspector's draft inputs; the screen copies the uploaded files (their bytes live in
 * the attachments service) and then records their names. This module holds the file leg and
 * the one-line summary the toast shows.
 */
import {
  fillPropertyGroupDocumentNames,
  type PropertyGroupLinkSyncDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import {
  clonePropertyDocumentsIntoEmptyKinds,
  type ClonedPropertyDocNames,
} from "./assignment-doc-attachments";

export type GroupDocumentsCopied = {
  /** Document slots filled on the deed the link was confirmed from. */
  toSubject: number;
  /** Document slots filled on the deed it was linked to. */
  toTarget: number;
};

function countNames(names: ClonedPropertyDocNames): number {
  return (
    names.assignmentDocFileNames.length +
    names.delegationLetterFileNames.length +
    names.otherDocumentFileNames.length +
    [
      names.realEstateRegFileName,
      names.deedOwnershipFileName,
      names.bourseDeedImageFileName,
      names.boundariesExternalDocName,
    ].filter((n) => n.trim()).length
  );
}

/**
 * Copies each deed's documents onto the other where the other has none of that kind, then
 * records the stored names on the server (empty name slots only). Never throws: a failed leg
 * just counts as nothing copied — the link itself is already confirmed.
 */
export async function copyGroupDocumentsBothWays(input: {
  subjectPo: string;
  subjectPropertyId: string;
  targetPo: string;
  targetPropertyId: string;
}): Promise<GroupDocumentsCopied> {
  const none: GroupDocumentsCopied = { toSubject: 0, toTarget: 0 };
  const subjectPo = input.subjectPo.trim();
  const targetPo = input.targetPo.trim();
  if (!subjectPo || !targetPo || !input.subjectPropertyId || !input.targetPropertyId) return none;
  const config = prototypeModulesApiConfig();
  if (!config) return none;

  try {
    const [toTarget, toSubject] = await Promise.all([
      clonePropertyDocumentsIntoEmptyKinds(subjectPo, input.subjectPropertyId, targetPo, input.targetPropertyId),
      clonePropertyDocumentsIntoEmptyKinds(targetPo, input.targetPropertyId, subjectPo, input.subjectPropertyId),
    ]);
    const copied = { toSubject: countNames(toSubject), toTarget: countNames(toTarget) };
    await Promise.all([
      copied.toTarget > 0
        ? fillPropertyGroupDocumentNames(config, input.targetPropertyId, toTarget)
        : Promise.resolve(null),
      copied.toSubject > 0
        ? fillPropertyGroupDocumentNames(config, input.subjectPropertyId, toSubject)
        : Promise.resolve(null),
    ]);
    return copied;
  } catch {
    return none;
  }
}

/** One line for the toast after a link: what moved, in words the specialist reads. */
export function linkSyncSummaryAr(
  sync: PropertyGroupLinkSyncDto | null | undefined,
  documents: GroupDocumentsCopied = { toSubject: 0, toTarget: 0 },
): string {
  const parts: string[] = [];
  const fields = (sync?.subjectFieldsFilled.length ?? 0) + (sync?.targetFieldsFilled.length ?? 0);
  if (fields > 0) parts.push(`${fields} ${fields === 1 ? "حقل" : "حقول"} بيانات`);
  if (sync?.contactsCopiedToSubject || sync?.contactsCopiedToTarget) parts.push("جهات الاتصال");
  const docs = documents.toSubject + documents.toTarget;
  if (docs > 0) parts.push(`${docs} ${docs === 1 ? "مستند" : "مستندات"}`);
  const inspector = (sync?.inspectorSlotsFilledOnSubject ?? 0) + (sync?.inspectorSlotsFilledOnTarget ?? 0);
  if (inspector > 0) parts.push("مدخلات المعاين");
  if (parts.length === 0) {
    return "تم تأكيد الربط — لا بيانات ناقصة في أي من الصكين";
  }
  return `تم تأكيد الربط ونُقل إلى الصك الآخر ما كان ناقصًا: ${parts.join("، ")}`;
}
