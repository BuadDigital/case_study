import { fetchReportingDashboard } from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";

export async function loadReportingDashboard() {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchReportingDashboard(config);
  return unwrapApiResult(result, "تعذّر تحميل لوحة التقارير");
}
