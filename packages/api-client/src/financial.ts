import { getApiBase } from "./index";
import type { PrototypeModulesApiConfig, PrototypeModulesResult } from "./prototype-modules";

export type FinancialRevenueRowDto = {
  po: string;
  billed: number;
  excluded: number;
  value: string;
  status: string;
  invoiceNumber?: string | null;
};

export type FinancialCostRowDto = {
  name: string;
  type: string;
  cost: string;
  category: string;
};

export type FinancialSummaryDto = {
  periodLabel: string;
  revenueTotal: string;
  externalCostsTotal: string;
  profitMarginTotal: string;
  profitMarginPercentLabel: string;
  pendingPayablesTotal: string;
  revenueRows: FinancialRevenueRowDto[];
  costRows: FinancialCostRowDto[];
  revenueGrandTotal: string;
};

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function baseUrl(config: PrototypeModulesApiConfig): string {
  return config.baseUrl ?? getApiBase();
}

export async function fetchFinancialSummary(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<FinancialSummaryDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/financial/v1/summary`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as FinancialSummaryDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function financialApiEnabled(config: PrototypeModulesApiConfig | null): boolean {
  return config !== null;
}
