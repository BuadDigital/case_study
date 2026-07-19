import {
  fetchFinancialSummary,
  fetchPartyFeePricing,
  financialApiEnabled as apiEnabled,
  savePartyFeePricing,
  type FinancialSummaryDto,
  type PartyFeePricingDto,
} from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  prototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";

export type { FinancialSummaryDto, PartyFeePricingDto };

export async function loadFinancialSummary(): Promise<FinancialSummaryDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchFinancialSummary(config);
  return unwrapApiResult(result, "تعذّر تحميل الملخص المالي");
}

export async function loadPartyFeePricing(): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchPartyFeePricing(config);
  return unwrapApiResult(result, "تعذّر تحميل تسعير الأتعاب");
}

export async function savePartyFeePricingConfig(
  body: PartyFeePricingDto,
): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await savePartyFeePricing(config, body);
  return unwrapApiResult(result, "تعذّر حفظ تسعير الأتعاب");
}

export function financialApiEnabled(): boolean {
  return apiEnabled(prototypeModulesApiConfig());
}
