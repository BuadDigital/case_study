import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { PrototypeModulesApiConfig, PrototypeModulesResult } from "./prototype-modules";
import type { FinancialRevenueRowStatus } from "./property-list-wire";
import { fetchListPage, type PagedResultDto } from "./pagination";
import type { ApiErr, ApiOk } from "./work-orders";

type FinancialRevenueRowDto = {
  po: string;
  billed: number;
  excluded: number;
  value: string;
  status: FinancialRevenueRowStatus;
  invoiceNumber?: string | null;
};

type FinancialCostRowDto = {
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
  | "court-visit"
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
  courtVisitFeeSar: number;
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

/* ------------------------------------------------------------------------- *
 * Financial ledgers — pagination-contract §7.
 *
 * Two lists on `FinancialController` with the same row shape and one rules
 * module, reached through `CapabilityPolicyNames.ManageOperations`. No screen
 * pages them today; the typed fetchers exist so a supervisor screen can, with
 * no server change. Both routes are also served under the `api/financial/v1`
 * alias, which is the one used here.
 * ------------------------------------------------------------------------- */

/** Allowed `sort` keys on both ledgers. Unknown keys fall back to `created`. */
export type FinancialLedgerListSort = "created" | "transaction";

type FinancialLedgerPageQuery = {
  /** 1-based page; presence switches the endpoint to the paged envelope. */
  page?: number;
  pageSize?: number;
  sort?: FinancialLedgerListSort;
  /** Default `desc`. */
  dir?: "asc" | "desc";
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

/** `GET /api/financial/incentive-suspensions` query — pagination-contract §7.1. */
export type IncentiveSuspensionListQuery = FinancialLedgerPageQuery & {
  /** Free text over `TransactionKey`, `AssigneeId`, `Reason`. */
  q?: string;
  transactionKey?: string;
  assigneeId?: string;
  /** Server default `true` — only suspensions that have not been lifted. */
  activeOnly?: boolean;
};

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

/** `GET /api/financial/discount-flags` query — pagination-contract §7.2. */
export type DiscountFlagListQuery = FinancialLedgerPageQuery & {
  /** Free text over `TransactionKey`, `TargetAssigneeId`, `Reason`. */
  q?: string;
  transactionKey?: string;
  /** Exact `pending` | `approved` | `rejected`; anything else matches no row. */
  status?: string;
};

function incentiveSuspensionListParams(query?: IncentiveSuspensionListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    transactionKey: query?.transactionKey,
    assigneeId: query?.assigneeId,
    activeOnly: query?.activeOnly,
  };
}

function discountFlagListParams(query?: DiscountFlagListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    transactionKey: query?.transactionKey,
    status: query?.status,
  };
}

/** One server page of the incentive-suspension ledger — pagination-contract §7.1. */
export async function listIncentiveSuspensionsPage(
  config: PrototypeModulesApiConfig,
  query?: IncentiveSuspensionListQuery,
): Promise<ApiOk<PagedResultDto<IncentiveSuspensionDto>> | ApiErr> {
  return fetchListPage<IncentiveSuspensionDto>(
    { ...config, baseUrl: baseUrl(config) },
    "/api/financial/v1/incentive-suspensions",
    incentiveSuspensionListParams(query),
  );
}

/** One server page of the discount-flag ledger — pagination-contract §7.2. */
export async function listDiscountFlagsPage(
  config: PrototypeModulesApiConfig,
  query?: DiscountFlagListQuery,
): Promise<ApiOk<PagedResultDto<DiscountFlagDto>> | ApiErr> {
  return fetchListPage<DiscountFlagDto>(
    { ...config, baseUrl: baseUrl(config) },
    "/api/financial/v1/discount-flags",
    discountFlagListParams(query),
  );
}
