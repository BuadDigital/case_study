import {
  getCaseStudyInfoRoles,
  saveCaseStudyInfoRoles,
} from "@platform/api-client";
import {
  apiErrorMessage,
  caseStudyInfoRolesApiConfig,
} from "../settings-api-config";
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

function emptyMatrix(): CaseStudyInfoRolesMatrix {
  const matrix: CaseStudyInfoRolesMatrix = {};
  for (const q of CASE_STUDY_QUESTION_CATALOG) {
    matrix[q.key] = {};
    for (const p of CASE_STUDY_INFO_PARTIES) {
      matrix[q.key]![p.id] = undefined;
    }
  }
  return matrix;
}

export function emptyCaseStudyInfoRolesConfig(): CaseStudyInfoRolesConfig {
  return {
    matrix: defaultCaseStudyInfoRolesMatrix(),
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

function mergeConfig(
  partial: Pick<CaseStudyInfoRolesConfig, "matrix" | "notes" | "updatedAt">,
): CaseStudyInfoRolesConfig {
  const defaults = defaultCaseStudyInfoRolesMatrix();
  const matrix: CaseStudyInfoRolesMatrix = {};

  for (const q of CASE_STUDY_QUESTION_CATALOG) {
    matrix[q.key] = { ...(defaults[q.key] ?? {}) };
  }

  for (const [questionKey, parties] of Object.entries(partial.matrix ?? {})) {
    if (!matrix[questionKey]) matrix[questionKey] = {};
    for (const [partyId, role] of Object.entries(parties ?? {})) {
      if (!role || role === "none") {
        delete matrix[questionKey]![partyId as CaseStudyInfoPartyId];
        continue;
      }
      matrix[questionKey]![partyId as CaseStudyInfoPartyId] =
        role as CaseStudyInfoRoleType;
    }
  }

  return {
    matrix,
    notes: { ...partial.notes },
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

export function notifyCaseStudyInfoRolesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CASE_STUDY_INFO_ROLES_CHANGED_EVENT));
  }
}

export async function loadCaseStudyInfoRolesConfig(): Promise<CaseStudyInfoRolesConfig> {
  const config = caseStudyInfoRolesApiConfig();
  if (!config) return emptyCaseStudyInfoRolesConfig();

  const result = await getCaseStudyInfoRoles(config);
  if (!result.ok) {
    console.warn(apiErrorMessage(result.kind, "Info roles API"));
    return emptyCaseStudyInfoRolesConfig();
  }

  return mergeConfig({
    matrix: result.config.matrix as CaseStudyInfoRolesMatrix,
    notes: result.config.notes ?? {},
    updatedAt: result.config.updatedAt,
  });
}

export async function saveCaseStudyInfoRolesConfig(
  config: CaseStudyInfoRolesConfig,
): Promise<CaseStudyInfoRolesConfig | null> {
  const apiConfig = caseStudyInfoRolesApiConfig();
  if (!apiConfig) return null;

  const result = await saveCaseStudyInfoRoles(apiConfig, {
    matrix: config.matrix,
    notes: config.notes,
  });

  if (!result.ok) {
    console.warn(apiErrorMessage(result.kind, "Info roles API"));
    return null;
  }

  const saved = mergeConfig({
    matrix: result.config.matrix as CaseStudyInfoRolesMatrix,
    notes: result.config.notes ?? {},
    updatedAt: result.config.updatedAt,
  });
  notifyCaseStudyInfoRolesChanged();
  return saved;
}

/** يمكن للطرف الإجابة إذا له دور غير «لا دور». */
export function canPartyAnswerQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
): boolean {
  const role = matrix[questionKey]?.[partyId];
  return role === "primary" || role === "secondary" || role === "verify";
}

/** يُعرض السؤال للطرف فقط إذا لم يكن دوره «لا دور» (أو غير مُعرَّف). */
export function isPartyQuestionVisible(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
): boolean {
  return canPartyAnswerQuestion(matrix, questionKey, partyId);
}

/** هل السؤال مسند لأي طرف (للمراجعة من الأخصائي). */
export function isAnyPartyAssignedToQuestion(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
): boolean {
  return CASE_STUDY_INFO_PARTIES.some((party) =>
    canPartyAnswerQuestion(matrix, questionKey, party.id),
  );
}

/** الأخصائي يراجع أي سؤال مسند لطرف واحد على الأقل — حتى «مكونات العقار» للمعاين فقط. */
export function isCaseStudyQuestionVisibleToSpecialist(
  matrix: CaseStudyInfoRolesMatrix,
  questionKey: string,
): boolean {
  return isAnyPartyAssignedToQuestion(matrix, questionKey);
}

/** الأخصائي يعتمد الإجابة الرسمية لأي سؤال يظهر في مراجعته. */
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
