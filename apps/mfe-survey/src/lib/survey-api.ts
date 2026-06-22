import { listSurveyOffices } from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { SurveyOfficeListRow } from "./survey-types";

export async function loadSurveyOffices(): Promise<SurveyOfficeListRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const result = await listSurveyOffices(config);
  if (!result.ok) return [];

  return result.data.map((row) => ({
    id: row.id,
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
