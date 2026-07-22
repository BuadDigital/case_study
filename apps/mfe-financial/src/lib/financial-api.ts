import {
  activatePartyFeePricing,
  createPartyFeePricing,
  deletePartyFeePricing,
  fetchFinancialSummary,
  fetchPartyFeePricingById,
  fetchPartyFeePricingTables,
  financialApiEnabled as apiEnabled,
  savePartyFeePricing,
  setPartyFeePricingAssignments,
  type FinancialSummaryDto,
  type PartyFeePricingCategory,
  type PartyFeePricingDto,
  type PartyFeePricingTableSummaryDto,
} from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  prototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";

export type {
  FinancialSummaryDto,
  PartyFeePricingDto,
  PartyFeePricingTableSummaryDto,
  PartyFeePricingCategory,
};

export async function loadFinancialSummary(): Promise<FinancialSummaryDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchFinancialSummary(config);
  return unwrapApiResult(result, "تعذّر تحميل الملخص المالي");
}

export async function loadPartyFeePricingTables(
  category: PartyFeePricingCategory,
): Promise<PartyFeePricingTableSummaryDto[]> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchPartyFeePricingTables(config, category);
  return unwrapApiResult(result, "تعذّر تحميل جداول التسعير");
}

export async function loadPartyFeePricingById(id: string): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await fetchPartyFeePricingById(config, id);
  return unwrapApiResult(result, "تعذّر تحميل تسعير الأتعاب");
}

export async function createPartyFeePricingTable(
  category: PartyFeePricingCategory,
  name: string,
  copyFromTableId?: string | null,
): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await createPartyFeePricing(config, {
    category,
    name,
    copyFromTableId: copyFromTableId ?? null,
  });
  return unwrapApiResult(result, "تعذّر إنشاء جدول التسعير");
}

export async function savePartyFeePricingConfig(
  id: string,
  body: PartyFeePricingDto,
): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await savePartyFeePricing(config, id, body);
  return unwrapApiResult(result, "تعذّر حفظ تسعير الأتعاب");
}

export async function activatePartyFeePricingTable(
  id: string,
): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await activatePartyFeePricing(config, id);
  return unwrapApiResult(result, "تعذّر تعيين الجدول كافتراضي");
}

export async function savePartyFeePricingAssignments(
  id: string,
  assigneeIds: string[],
): Promise<PartyFeePricingDto> {
  const config = requirePrototypeModulesApiConfig();
  const result = await setPartyFeePricingAssignments(config, id, { assigneeIds });
  return unwrapApiResult(result, "تعذّر حفظ إسناد التسعيرة");
}

export async function deletePartyFeePricingTable(id: string): Promise<void> {
  const config = requirePrototypeModulesApiConfig();
  const result = await deletePartyFeePricing(config, id);
  unwrapApiResult(result, "تعذّر حذف جدول التسعير");
}

export function financialApiEnabled(): boolean {
  return apiEnabled(prototypeModulesApiConfig());
}
