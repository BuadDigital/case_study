import { listSurveyOffices } from "@platform/api-client";
import type { SurveyOfficeRow } from "@platform/app-shared/prototype/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export async function loadSurveyOffices(): Promise<SurveyOfficeRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const result = await listSurveyOffices(config);
  if (!result.ok) return [];

  return result.data.map((row) => ({
    name: row.name,
    active: row.active,
    doneMonth: row.doneMonth,
    avgDays: row.avgDays,
    contract: row.contract,
    statusBusy: row.statusBusy,
  }));
}

export function surveyApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
