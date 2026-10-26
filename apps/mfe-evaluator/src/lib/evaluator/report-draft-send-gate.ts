/**
 * Round 2 — the specialist cannot send the valuation-report draft while a required report document
 * that only he uploads is missing (issuance gate `required_attachments`: «صك الملكية»,
 * «التقرير المساحي» …): the appraiser's approval issues the deposit copy through the same gate, so it
 * would be refused for a document the appraiser cannot add. Mirrors the server's
 * `ReportDraftSendRules`; the server refuses the send on its own as well. Pure.
 */
import type { ValuationIssuanceGatesDto } from "@platform/api-client";

export const REPORT_DRAFT_MISSING_DOCUMENTS_PREFIX =
  "لا تُرسَل المسودة للمقيّم قبل رفع المستندات الإلزامية التي يرفعها الأخصائي — ";

/** The missing specialist documents as the gate names them, or null when nothing is missing. */
export function missingSpecialistDocuments(
  gates: Pick<ValuationIssuanceGatesDto, "gates"> | null | undefined,
): string | null {
  const gate = (gates?.gates ?? []).find(
    (g) => g.isHard && !g.passed && g.code.trim().toLowerCase() === "required_attachments",
  );
  if (!gate) return null;
  return gate.detailAr?.trim() || gate.labelAr.trim();
}
