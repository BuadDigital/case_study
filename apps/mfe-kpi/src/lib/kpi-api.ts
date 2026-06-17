import {
  fetchReportingKpi,
  type ReportingKpiDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export type { ReportingKpiDto };

export async function loadReportingKpi(): Promise<ReportingKpiDto | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await fetchReportingKpi(config);
  return result.ok ? result.data : null;
}

export function kpiApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
