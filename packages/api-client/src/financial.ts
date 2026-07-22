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

export type PartyFeePricingCategory =
  | "engineering-survey"
  | "government-review"
  | "field-inspector";

export type PartyFeePricingTableSummaryDto = {
  id: string;
  category: PartyFeePricingCategory;
  name: string;
  isActive: boolean;
  assignedCount?: number;
  updatedAtUtc?: string | null;
};

export type PartyFeePricingTierDto = {
  id?: string | null;
  sortOrder: number;
  maxAreaM2?: number | null;
  feeSar: number;
};

export type PartyFeePricingDto = {
  id: string;
  category: PartyFeePricingCategory;
  name: string;
  isActive: boolean;
  assignedCount?: number;
  assignedAssigneeIds?: string[];
  areaTiers: PartyFeePricingTierDto[];
  governmentReviewFeeSar: number;
  keyReceiptFeeSar: number;
  fieldInspectorIndividualFeeSar: number;
  fieldInspectorOrganizationFeeSar: number;
  updatedAtUtc?: string | null;
};

export type CreatePartyFeePricingTableRequest = {
  category: PartyFeePricingCategory;
  name: string;
  copyFromTableId?: string | null;
};

export type SetPartyFeePricingAssignmentsRequest = {
  assigneeIds: string[];
};

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function baseUrl(config: PrototypeModulesApiConfig): string {
  return config.baseUrl ?? getApiBase();
}

async function readResult<T>(
  res: Response,
): Promise<PrototypeModulesResult<T>> {
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (res.status === 404) return { ok: false, kind: "server" };
  if (!res.ok) return { ok: false, kind: "server" };
  if (res.status === 204) return { ok: true, data: undefined as T };
  return { ok: true, data: (await res.json()) as T };
}

export async function fetchFinancialSummary(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<FinancialSummaryDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/financial/v1/summary`, {
      headers: headers(config.token),
    });
    return readResult<FinancialSummaryDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Active pricing schedule. */
export async function fetchPartyFeePricing(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/financial/v1/party-fee-pricing`, {
      headers: headers(config.token),
    });
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function fetchPartyFeePricingTables(
  config: PrototypeModulesApiConfig,
  category?: PartyFeePricingCategory,
): Promise<PrototypeModulesResult<PartyFeePricingTableSummaryDto[]>> {
  try {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/tables${qs}`,
      { headers: headers(config.token) },
    );
    return readResult<PartyFeePricingTableSummaryDto[]>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function fetchPartyFeePricingById(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}`,
      { headers: headers(config.token) },
    );
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createPartyFeePricing(
  config: PrototypeModulesApiConfig,
  body: CreatePartyFeePricingTableRequest,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/financial/v1/party-fee-pricing`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyFeePricing(
  config: PrototypeModulesApiConfig,
  id: string,
  body: PartyFeePricingDto,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function activatePartyFeePricing(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}/activate`,
      { method: "POST", headers: headers(config.token) },
    );
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function fetchPartyFeePricingAssignments(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<string[]>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}/assignments`,
      { headers: headers(config.token) },
    );
    return readResult<string[]>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function setPartyFeePricingAssignments(
  config: PrototypeModulesApiConfig,
  id: string,
  body: SetPartyFeePricingAssignmentsRequest,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}/assignments`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    return readResult<PartyFeePricingDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deletePartyFeePricing(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<void>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}`,
      { method: "DELETE", headers: headers(config.token) },
    );
    return readResult<void>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function financialApiEnabled(config: PrototypeModulesApiConfig | null): boolean {
  return config !== null;
}
