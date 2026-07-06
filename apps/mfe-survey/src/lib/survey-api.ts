import { listSurveyOffices } from "@platform/api-client";
import {
  prototypeModulesApiConfig,
  requirePrototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { SurveyOfficeListRow } from "./survey-types";

export async function loadSurveyOffices(): Promise<SurveyOfficeListRow[]> {
  const config = requirePrototypeModulesApiConfig();
  const result = await listSurveyOffices(config);
  return unwrapApiResult(result, "تعذّر تحميل مكاتب المساحة").map((row) => ({
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
