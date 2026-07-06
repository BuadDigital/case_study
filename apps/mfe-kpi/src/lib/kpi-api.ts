import {
  fetchReportingKpi,
  type ReportingKpiDto,
} from "@platform/api-client";
import {
  prototypeModulesApiConfig,
  requirePrototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";

export type { ReportingKpiDto };

export async function loadReportingKpi(): Promise<ReportingKpiDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchReportingKpi(config);
  return unwrapApiResult(result, "تعذّر تحميل مؤشرات الأداء");
}

export function kpiApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
