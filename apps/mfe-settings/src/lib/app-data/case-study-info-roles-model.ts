import type {
  CaseStudyInfoPartyId,
  CaseStudyInfoRoleType,
} from "./case-study-info-roles-data";
import { CASE_STUDY_INFO_PARTIES } from "./case-study-info-roles-data";
import { CASE_STUDY_QUESTION_CATALOG } from "./case-study-info-roles-data";
import { defaultCaseStudyInfoRolesMatrix } from "./default-case-study-info-roles-matrix";

export const CASE_STUDY_INFO_ROLES_CHANGED_EVENT = "case-study-info-roles-changed";

/** questionKey → partyId → role */
export type CaseStudyInfoRolesMatrix = Record<
  string,
  Partial<Record<CaseStudyInfoPartyId, CaseStudyInfoRoleType>>
>;

export type CaseStudyInfoRolesConfig = {
  matrix: CaseStudyInfoRolesMatrix;
  notes: Record<string, string>;
  updatedAt: string;
};


export function emptyCaseStudyInfoRolesConfig(): CaseStudyInfoRolesConfig {
  return {
    matrix: defaultCaseStudyInfoRolesMatrix(),
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMatrixFromSaved(
  saved: CaseStudyInfoRolesMatrix | undefined,
): CaseStudyInfoRolesMatrix {
  const matrix: CaseStudyInfoRolesMatrix = {};
  for (const q of CASE_STUDY_QUESTION_CATALOG) {
    const row = saved?.[q.key] ?? {};
    const clean: Partial<Record<CaseStudyInfoPartyId, CaseStudyInfoRoleType>> =
      {};
    for (const [partyId, role] of Object.entries(row)) {
      if (!role || role === "none") continue;
      clean[partyId as CaseStudyInfoPartyId] = role as CaseStudyInfoRoleType;
    }
    matrix[q.key] = clean;
  }
  return matrix;
}

export function isStoredCaseStudyInfoRolesMatrixEmpty(
  saved: CaseStudyInfoRolesMatrix | undefined,
): boolean {
  if (!saved || Object.keys(saved).length === 0) return true;
  return !Object.values(saved).some((row) =>
    Object.values(row ?? {}).some((role) => role && role !== "none"),
  );
}

export function seedConfigFromDefaults(): CaseStudyInfoRolesConfig {
  return {
    matrix: defaultCaseStudyInfoRolesMatrix(),
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

export function mergeConfig(
  partial: Pick<CaseStudyInfoRolesConfig, "matrix" | "notes" | "updatedAt">,
): CaseStudyInfoRolesConfig {
  const savedMatrix = partial.matrix as CaseStudyInfoRolesMatrix | undefined;

  if (isStoredCaseStudyInfoRolesMatrixEmpty(savedMatrix)) {
    return seedConfigFromDefaults();
  }

  return {
    matrix: normalizeMatrixFromSaved(savedMatrix),
    notes: { ...(partial.notes ?? {}) },
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

export function notifyCaseStudyInfoRolesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CASE_STUDY_INFO_ROLES_CHANGED_EVENT));
  }
}

/** Party may answer if its role is not «no role». */
export function canPartyAnswerQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
): boolean {
  const role = matrix[questionKey]?.[partyId];
  return role === "primary" || role === "secondary" || role === "verify";
}

/** Show the question to the party only if its role is not «no role» (or undefined). */
export function isPartyQuestionVisible(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
): boolean {
  return canPartyAnswerQuestion(matrix, questionKey, partyId);
}

/** Whether the question is assigned to any party (for specialist review). */
export function isAnyPartyAssignedToQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
): boolean {
  return CASE_STUDY_INFO_PARTIES.some((party) =>
    canPartyAnswerQuestion(matrix, questionKey, party.id),
  );
}

/** Specialist reviews any question assigned to at least one party — even «property components» for inspector only. */
export function isCaseStudyQuestionVisibleToSpecialist(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
): boolean {
  return isAnyPartyAssignedToQuestion(matrix, questionKey);
}

/** Specialist confirms the official answer for any question in their review. */
export function canSpecialistApproveQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
): boolean {
  return isCaseStudyQuestionVisibleToSpecialist(matrix, questionKey);
}

export function partyRoleOnQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
): CaseStudyInfoRoleType | null | undefined {
  return matrix[questionKey]?.[partyId] ?? null;
}
