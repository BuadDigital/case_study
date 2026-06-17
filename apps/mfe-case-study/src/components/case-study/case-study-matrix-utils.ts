import type { CaseStudyFormAnswer } from "../../lib/prototype/case-study-form-data";
import type { PartyQuestionContribution } from "../../lib/prototype/case-study-party-answers";
import type { CaseStudyInfoPartyId } from "@settings/mfe";
export type MatrixYn = "Y" | "N";
export type PartyMatrixKey = "MA" | "EN" | "EV" | "GR";
export const PARTY_MATRIX_ORDER: PartyMatrixKey[] = ["MA", "EN", "EV", "GR"];
const PARTY_ID_TO_MATRIX: Partial<Record<CaseStudyInfoPartyId, PartyMatrixKey>> =
  {
    insp: "MA",
    eng: "EN",
    val: "EV",
    gov: "GR",
  };

export const PARTY_MATRIX_SHORT: Record<PartyMatrixKey, string> = {
  MA: "معاين",
  EN: "مكتب",
  EV: "مقيم",
  GR: "مراجع",
};

export type MatrixRowStatus = "pending" | "consensus" | "conflict";

export function answerToYn(
  value: CaseStudyFormAnswer | null | undefined,
): MatrixYn | null {
  if (value === "A") return "Y";
  if (value === "B") return "N";
  return null;
}

export function ynToAnswer(value: MatrixYn | null): CaseStudyFormAnswer | null {
  if (value === "Y") return "A";
  if (value === "N") return "B";
  return null;
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

export function getMatrixRowStatus(
  answers: Partial<Record<PartyMatrixKey, MatrixYn>>,
): MatrixRowStatus {
  const vals = Object.values(answers);
  if (vals.length === 0) return "pending";
  const hasY = vals.includes("Y");
  const hasN = vals.includes("N");
  if (hasY && hasN) return "conflict";
  return "consensus";
}

export function getMatrixConsensus(
  answers: Partial<Record<PartyMatrixKey, MatrixYn>>,
): MatrixYn | null {
  const vals = Object.values(answers);
  if (vals.length === 0) return null;
  return vals.every((v) => v === vals[0]) ? vals[0]! : null;
}
