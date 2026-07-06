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

function seedConfigFromDefaults(): CaseStudyInfoRolesConfig {
  return {
    matrix: defaultCaseStudyInfoRolesMatrix(),
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

function mergeConfig(
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

let seedInFlight = false;

async function seedDefaultsIfEmpty(): Promise<void> {
  if (seedInFlight) return;
  seedInFlight = true;
  try {
    const seeded = seedConfigFromDefaults();
    await saveCaseStudyInfoRolesConfig(seeded);
  } finally {
    seedInFlight = false;
  }
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
    throw new Error(
      apiErrorMessage(result.kind, "تعذّر تحميل مصفوفة أدوار دراسة الحالة"),
    );
  }

  const rawMatrix = result.config.matrix as CaseStudyInfoRolesMatrix;
  if (isStoredCaseStudyInfoRolesMatrixEmpty(rawMatrix)) {
    const seeded = seedConfigFromDefaults();
    void seedDefaultsIfEmpty();
    return seeded;
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
