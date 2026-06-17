import {
  fetchFinancialSummary,
  financialApiEnabled as apiEnabled,
  type FinancialSummaryDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export type { FinancialSummaryDto };

export async function loadFinancialSummary(): Promise<FinancialSummaryDto | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await fetchFinancialSummary(config);
  return result.ok ? result.data : null;
}

export function financialApiEnabled(): boolean {
  return apiEnabled(prototypeModulesApiConfig());
}
