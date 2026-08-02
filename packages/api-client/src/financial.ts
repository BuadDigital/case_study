import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
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

export type PartyFeePricingKind = "tiered" | "party-rates" | "flat";
export type PartyFeePricingManagedBy = "system-admin" | "supervisor";

export type PartyFeePricingTableSummaryDto = {
  id: string;
  category: PartyFeePricingCategory;
  name: string;
  pricingKind?: PartyFeePricingKind | string;
  managedBy?: PartyFeePricingManagedBy | string;
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
  pricingKind?: PartyFeePricingKind | string;
  managedBy?: PartyFeePricingManagedBy | string;
  isActive: boolean;
  assignedCount?: number;
  assignedAssigneeIds?: string[];
  areaTiers: PartyFeePricingTierDto[];
  governmentReviewFeeSar: number;
  fieldInspectorIndividualFeeSar: number;
  fieldInspectorOrganizationFeeSar: number;
  flatAmountSar?: number;
  updatedAtUtc?: string | null;
};

export type CreatePartyFeePricingTableRequest = {
  category: PartyFeePricingCategory;
  name: string;
  pricingKind?: PartyFeePricingKind;
  managedBy?: PartyFeePricingManagedBy;
  flatAmountSar?: number;
  copyFromTableId?: string | null;
};

export type IncentiveSuspensionDto = {
  id: string;
  userId: string;
  assigneeId: string;
  transactionKey: string;
  reason: string;
  isActive: boolean;
  createdAtUtc: string;
  liftedAtUtc?: string | null;
};

export type CreateIncentiveSuspensionRequest = {
  assigneeId: string;
  transactionKey: string;
  reason: string;
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

export async function revisePartyFeePricing(
  config: PrototypeModulesApiConfig,
  id: string,
  body: PartyFeePricingDto,
): Promise<PrototypeModulesResult<PartyFeePricingDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/party-fee-pricing/${id}/revision`,
      {
        method: "POST",
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

export type DiscountFlagDto = {
  id: string;
  transactionKey: string;
  workflowTaskId?: string | null;
  targetAssigneeId: string;
  flaggedByUserId: string;
  reason: string;
  proposedDiscountSar: number;
  status: string;
  approvedByUserId?: string | null;
  resolvedAtUtc?: string | null;
  resolutionNote?: string | null;
  createdAtUtc: string;
};

export type CreateDiscountFlagRequest = {
  transactionKey: string;
  workflowTaskId?: string | null;
  targetAssigneeId: string;
  reason: string;
  proposedDiscountSar: number;
};

export type ResolveDiscountFlagRequest = {
  discountSar?: number | null;
  discountReason?: string | null;
  note?: string | null;
};

export async function listDiscountFlags(
  config: PrototypeModulesApiConfig,
  opts?: { transactionKey?: string; status?: string },
): Promise<PrototypeModulesResult<DiscountFlagDto[]>> {
  try {
    const params = new URLSearchParams();
    if (opts?.transactionKey) params.set("transactionKey", opts.transactionKey);
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString() ? `?${params}` : "";
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/discount-flags${qs}`,
      { headers: headers(config.token) },
    );
    return readResult<DiscountFlagDto[]>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createDiscountFlag(
  config: PrototypeModulesApiConfig,
  body: CreateDiscountFlagRequest,
): Promise<PrototypeModulesResult<DiscountFlagDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/financial/v1/discount-flags`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    return readResult<DiscountFlagDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function approveDiscountFlag(
  config: PrototypeModulesApiConfig,
  id: string,
  body?: ResolveDiscountFlagRequest,
): Promise<PrototypeModulesResult<DiscountFlagDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/discount-flags/${id}/approve`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body ?? {}),
      },
    );
    return readResult<DiscountFlagDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function rejectDiscountFlag(
  config: PrototypeModulesApiConfig,
  id: string,
  body?: ResolveDiscountFlagRequest,
): Promise<PrototypeModulesResult<DiscountFlagDto>> {
  try {
    const res = await fetch(
      `${baseUrl(config)}/api/financial/v1/discount-flags/${id}/reject`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body ?? {}),
      },
    );
    return readResult<DiscountFlagDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function financialApiEnabled(config: PrototypeModulesApiConfig | null): boolean {
  return config !== null;
}
