import type { CaseStudyReportAnswer } from "../../lib/app-data/case-study-report-data";
import type { PartyQuestionContribution } from "../../lib/app-data/case-study-party-answers";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import { CaseStudyReportAnswers } from "@platform/app-shared/app-data/case-study-report-model";
export type MatrixYn = "Y" | "N" | "NA";
type PartyAnswers = Partial<Record<CaseStudyInfoPartyId, MatrixYn>>;

/** The parties the matrix shows, in this order, with their short names. */
export const PARTY_MATRIX_SHORT: Partial<Record<CaseStudyInfoPartyId, string>> = {
  insp: "معاين",
  eng: "مكتب",
  val: "مقيّم",
};

type MatrixRowStatus = "pending" | "consensus" | "conflict";

/** The report's answer codes and the matrix's Y/N/NA — one table, read both ways. */
export const ANSWER_YN: [CaseStudyReportAnswer, MatrixYn][] = [
  [CaseStudyReportAnswers.A, "Y"],
  [CaseStudyReportAnswers.B, "N"],
  [CaseStudyReportAnswers.NA, "NA"],
];

export function contributionsToPartyAnswers(
  items: PartyQuestionContribution[],
): PartyAnswers {
  const out: PartyAnswers = {};
  for (const item of items) {
    if (!item.partyId || !PARTY_MATRIX_SHORT[item.partyId]) continue;
    const yn = ANSWER_YN.find(([answer]) => answer === item.answer)?.[1] ?? null;
    if (yn) out[item.partyId] = yn;
  }
  return out;
}

/**
 * Do the parties agree? No answers → pending; all the same → consensus on that answer;
 * otherwise conflict.
 */
export function matrixAgreement(answers: PartyAnswers): {
  status: MatrixRowStatus;
  consensus: MatrixYn | null;
} {
  const distinct = new Set(Object.values(answers));
  if (distinct.size === 0) return { status: "pending", consensus: null };
  if (distinct.size > 1) return { status: "conflict", consensus: null };
  return { status: "consensus", consensus: [...distinct][0]! };
}
