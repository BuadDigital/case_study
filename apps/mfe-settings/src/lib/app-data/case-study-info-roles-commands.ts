import { saveCaseStudyInfoRoles } from "@platform/api-client";
import { caseStudyInfoRolesApiConfig } from "../settings-api-config";
import {
  mergeConfig,
  notifyCaseStudyInfoRolesChanged,
  seedConfigFromDefaults,
  type CaseStudyInfoRolesConfig,
  type CaseStudyInfoRolesMatrix,
} from "./case-study-info-roles-model";

let seedInFlight = false;

export async function seedCaseStudyInfoRolesDefaultsIfEmpty(): Promise<void> {
  if (seedInFlight) return;
  seedInFlight = true;
  try {
    const seeded = seedConfigFromDefaults();
    await saveCaseStudyInfoRolesConfig(seeded);
  } finally {
    seedInFlight = false;
  }
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
