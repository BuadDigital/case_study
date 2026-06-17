import { fetchReportingDashboard } from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export async function loadReportingDashboard() {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await fetchReportingDashboard(config);
  return result.ok ? result.data : null;
}
