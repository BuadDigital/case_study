import type { CaseStudyReportAnswer } from "../../lib/app-data/case-study-report-data";
import type { PartyQuestionContribution } from "../../lib/app-data/case-study-party-answers";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
export type MatrixYn = "Y" | "N" | "NA";
type PartyMatrixKey = "MA" | "EN" | "EV";
export const PARTY_MATRIX_ORDER: PartyMatrixKey[] = ["MA", "EN", "EV"];
const PARTY_ID_TO_MATRIX: Partial<Record<CaseStudyInfoPartyId, PartyMatrixKey>> =
  {
    insp: "MA",
    eng: "EN",
    val: "EV",
  };

export const PARTY_MATRIX_SHORT: Record<PartyMatrixKey, string> = {
  MA: "معاين",
  EN: "مكتب",
  EV: "مقيّم",
};

type MatrixRowStatus = "pending" | "consensus" | "conflict";

/** The report's answer codes and the matrix's Y/N/NA — one table, read both ways. */
const ANSWER_YN: [CaseStudyReportAnswer, MatrixYn][] = [
  ["A", "Y"],
  ["B", "N"],
  ["NA", "NA"],
];
const YN_BY_ANSWER = new Map(ANSWER_YN);
const ANSWER_BY_YN = new Map(ANSWER_YN.map(([answer, yn]) => [yn, answer]));

export function answerToYn(
  value: CaseStudyReportAnswer | null | undefined,
): MatrixYn | null {
  return (value && YN_BY_ANSWER.get(value)) ?? null;
}

export function ynToAnswer(value: MatrixYn | null): CaseStudyReportAnswer | null {
  return (value && ANSWER_BY_YN.get(value)) ?? null;
}

export function contributionsToPartyAnswers(
  items: PartyQuestionContribution[],
): Partial<Record<PartyMatrixKey, MatrixYn>> {
  const out: Partial<Record<PartyMatrixKey, MatrixYn>> = {};
  for (const item of items) {
    if (!item.partyId) continue;
    const key = PARTY_ID_TO_MATRIX[item.partyId];
    if (!key) continue;
    const yn = answerToYn(item.answer);
    if (yn) out[key] = yn;
  }
  return out;
}

/**
 * Do the parties agree? No answers → pending; all the same → consensus on that answer;
 * otherwise conflict.
 */
export function matrixAgreement(answers: Partial<Record<PartyMatrixKey, MatrixYn>>): {
  status: MatrixRowStatus;
  consensus: MatrixYn | null;
} {
  const distinct = new Set(Object.values(answers));
  if (distinct.size === 0) return { status: "pending", consensus: null };
  if (distinct.size > 1) return { status: "conflict", consensus: null };
  return { status: "consensus", consensus: [...distinct][0]! };
}
