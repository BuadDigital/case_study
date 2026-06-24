import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type EnfazBillingApiConfig = WorkOrdersApiConfig;

export type PoEnfazRevenueLineDto = {
  id: string;
  poNumber: string;
  propertyId: string;
  propertyLabel: string;
  workStatus: string;
  workStatusLabel: string;
  enfazFeeSar: number;
  includedInBilling: boolean;
};

export type PoEnfazBillingDto = {
  poNumber: string;
  poReadyForBilling: boolean;
  lines: PoEnfazRevenueLineDto[];
  subtotalSar: number;
  vatSar: number;
  totalSar: number;
  invoiceNumber: string | null;
  invoiceIssuedAtUtc: string | null;
};

export type EnfazTrackingRowDto = {
  poNumber: string;
  propertyId: string;
  propertyLabel: string;
  workStatus: string;
  workStatusLabel: string;
  enfazFilled: boolean;
  enfazFeeSar: number;
};

export type EnfazReadyPoSummaryDto = {
  poNumber: string;
  doneCount: number;
  cancelledCount: number;
};

export type SavePoEnfazBillingRequest = {
  lines: {
    propertyId: string;
    enfazFeeSar: number;
    includedInBilling: boolean;
  }[];
};

export type PropertyEnfazRevenueDto = {
  enfazFeeSar: number | null;
  hasEnfazRevenue: boolean;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizeLine(raw: Record<string, unknown>): PoEnfazRevenueLineDto {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    propertyId: String(raw.propertyId ?? raw.PropertyId ?? ""),
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    workStatus: String(raw.workStatus ?? raw.WorkStatus ?? ""),
    workStatusLabel: String(raw.workStatusLabel ?? raw.WorkStatusLabel ?? ""),
    enfazFeeSar: Number(raw.enfazFeeSar ?? raw.EnfazFeeSar ?? 0),
    includedInBilling: Boolean(
      raw.includedInBilling ?? raw.IncludedInBilling ?? true,
    ),
  };
}

function normalizeBilling(raw: Record<string, unknown>): PoEnfazBillingDto {
  const linesRaw = (raw.lines ?? raw.Lines ?? []) as Record<string, unknown>[];
  return {
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    poReadyForBilling: Boolean(
      raw.poReadyForBilling ?? raw.PoReadyForBilling ?? false,
    ),
    lines: linesRaw.map(normalizeLine),
    subtotalSar: Number(raw.subtotalSar ?? raw.SubtotalSar ?? 0),
    vatSar: Number(raw.vatSar ?? raw.VatSar ?? 0),
    totalSar: Number(raw.totalSar ?? raw.TotalSar ?? 0),
    invoiceNumber: (raw.invoiceNumber ?? raw.InvoiceNumber ?? null) as
      | string
      | null,
    invoiceIssuedAtUtc: (raw.invoiceIssuedAtUtc ??
      raw.InvoiceIssuedAtUtc ??
      null) as string | null,
  };
}

function normalizeTrackingRow(
  raw: Record<string, unknown>,
): EnfazTrackingRowDto {
  return {
    poNumber: String(raw.poNumber ?? raw.PoNumber ?? ""),
    propertyId: String(raw.propertyId ?? raw.PropertyId ?? ""),
    propertyLabel: String(raw.propertyLabel ?? raw.PropertyLabel ?? ""),
    workStatus: String(raw.workStatus ?? raw.WorkStatus ?? ""),
    workStatusLabel: String(raw.workStatusLabel ?? raw.WorkStatusLabel ?? ""),
    enfazFilled: Boolean(raw.enfazFilled ?? raw.EnfazFilled ?? false),
    enfazFeeSar: Number(raw.enfazFeeSar ?? raw.EnfazFeeSar ?? 0),
  };
}

export async function listReadyEnfazPos(
  config: EnfazBillingApiConfig,
): Promise<ApiOk<string[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/enfaz-billing/ready-pos`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as string[] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listReadyEnfazPoSummaries(
  config: EnfazBillingApiConfig,
): Promise<ApiOk<EnfazReadyPoSummaryDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/enfaz-billing/ready-pos-summary`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>[];
    return {
      ok: true,
      data: raw.map((item) => ({
        poNumber: String(item.poNumber ?? item.PoNumber ?? ""),
        doneCount: Number(item.doneCount ?? item.DoneCount ?? 0),
        cancelledCount: Number(
          item.cancelledCount ?? item.CancelledCount ?? 0,
        ),
      })),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPoEnfazBilling(
  config: EnfazBillingApiConfig,
  poNumber: string,
): Promise<ApiOk<PoEnfazBillingDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/enfaz-billing/${encodeURIComponent(poNumber)}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeBilling(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePoEnfazBilling(
  config: EnfazBillingApiConfig,
  poNumber: string,
  body: SavePoEnfazBillingRequest,
): Promise<ApiOk<PoEnfazBillingDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/enfaz-billing/${encodeURIComponent(poNumber)}`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeBilling(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listEnfazTracking(
  config: EnfazBillingApiConfig,
): Promise<ApiOk<EnfazTrackingRowDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/enfaz-billing/tracking`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>[];
    return { ok: true, data: raw.map(normalizeTrackingRow) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function issuePoEnfazInvoice(
  config: EnfazBillingApiConfig,
  poNumber: string,
): Promise<ApiOk<PoEnfazBillingDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/enfaz-billing/${encodeURIComponent(poNumber)}/issue-invoice`,
      { method: "POST", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeBilling(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPropertyEnfazRevenue(
  config: EnfazBillingApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<PropertyEnfazRevenueDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/enfaz-billing/${encodeURIComponent(poNumber)}/properties/${propertyId}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        enfazFeeSar: (raw.enfazFeeSar ?? raw.EnfazFeeSar ?? null) as
          | number
          | null,
        hasEnfazRevenue: Boolean(
          raw.hasEnfazRevenue ?? raw.HasEnfazRevenue ?? false,
        ),
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}
