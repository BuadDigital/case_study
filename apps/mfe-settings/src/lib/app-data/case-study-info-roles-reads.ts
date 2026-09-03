import { getCaseStudyInfoRoles } from "@platform/api-client";
import {
  apiErrorMessage,
  caseStudyInfoRolesApiConfig,
} from "../settings-api-config";
import {
  emptyCaseStudyInfoRolesConfig,
  isStoredCaseStudyInfoRolesMatrixEmpty,
  mergeConfig,
  seedConfigFromDefaults,
  type CaseStudyInfoRolesConfig,
  type CaseStudyInfoRolesMatrix,
} from "./case-study-info-roles-model";

/**
 * Seeding the defaults writes, so it lives on the command side. Loaded lazily
 * to keep the static import graph one-way (commands → reads).
 */
function seedDefaultsIfEmpty(): void {
  void import("./case-study-info-roles-commands").then((m) =>
    m.seedCaseStudyInfoRolesDefaultsIfEmpty(),
  );
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
    seedDefaultsIfEmpty();
    return seeded;
  }

  return mergeConfig({
    matrix: result.config.matrix as CaseStudyInfoRolesMatrix,
    notes: result.config.notes ?? {},
    updatedAt: result.config.updatedAt,
  });
}
