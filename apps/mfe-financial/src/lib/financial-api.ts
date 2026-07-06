import {
  fetchFinancialSummary,
  financialApiEnabled as apiEnabled,
  type FinancialSummaryDto,
} from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  prototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";

export type { FinancialSummaryDto };

export async function loadFinancialSummary(): Promise<FinancialSummaryDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchFinancialSummary(config);
  return unwrapApiResult(result, "تعذّر تحميل الملخص المالي");
}

export function financialApiEnabled(): boolean {
  return apiEnabled(prototypeModulesApiConfig());
}
