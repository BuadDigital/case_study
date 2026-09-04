import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";
import { getApiBase } from "./api-base";

const DEFAULT_LIST_PAGE_SIZE = 500;

export type PagedResultDto<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * The five parameters every paged list endpoint accepts
 * (`docs/architecture/pagination-contract.md` → "Shared rules").
 */
export type ListPageQuery = {
  /** 1-based. Presence switches the endpoint to the paged envelope. */
  page?: number;
  /** Rows per page; the server clamps to `Database:MaxPageSize`. */
  pageSize?: number;
  /** A key from the endpoint's allow-list; unknown keys fall back to its default. */
  sort?: string;
  dir?: "asc" | "desc";
  /** Free text; blank/whitespace means "no search". */
  q?: string;
};

/** One query-string value: everything is serialised as a string on the wire. */
export type ListQueryParamValue =
  | string
  | number
  | boolean
  | readonly string[]
  | null
  | undefined;

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function isPagedResult<T>(data: unknown): data is PagedResultDto<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as PagedResultDto<T>).items)
  );
}

/**
 * Serialises list parameters the way the contract expects: blanks dropped,
 * arrays joined with `,` (the CSV filters), booleans as `true`/`false`.
 * Returns `""` when nothing survives, so the caller can append it directly.
 */
export function buildListQueryString(
  params?: Readonly<Record<string, ListQueryParamValue>>,
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const csv = value
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
        .join(",");
      if (csv) search.set(key, csv);
      continue;
    }
    if (typeof value === "boolean") {
      search.set(key, value ? "true" : "false");
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      search.set(key, String(value));
      continue;
    }
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    search.set(key, trimmed);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Normalises a plain-array body (unpaged endpoints) into the paged envelope. */
function arrayAsPage<T>(items: T[]): PagedResultDto<T> {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: items.length,
    totalPages: 1,
  };
}

async function requestPage<T>(
  config: WorkOrdersApiConfig,
  path: string,
  params?: Readonly<Record<string, ListQueryParamValue>>,
): Promise<ApiOk<PagedResultDto<T>> | ApiErr> {
  const base = (config.baseUrl ?? getApiBase()).replace(/\/$/, "");
  const url = `${base}${path}${buildListQueryString(params)}`;
  try {
    const res = await fetch(url, { headers: headers(config.token) });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as PagedResultDto<T> | T[];
    if (Array.isArray(data)) return { ok: true, data: arrayAsPage(data) };
    if (!isPagedResult<T>(data)) return { ok: false, kind: "server" };
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Fetches exactly ONE page and returns the `PagedResultDto` envelope. `page`
 * defaults to 1 so the server always answers with the envelope even when the
 * caller only passes filters.
 */
export async function fetchListPage<T>(
  config: WorkOrdersApiConfig,
  path: string,
  params?: Readonly<Record<string, ListQueryParamValue>>,
): Promise<ApiOk<PagedResultDto<T>> | ApiErr> {
  // Pulled out rather than spread over, so a caller passing `page: undefined`
  // (a typed query with the field omitted) still gets the paged envelope.
  const { page, pageSize, ...rest } = params ?? {};
  return requestPage<T>(config, path, {
    page: page ?? 1,
    pageSize: pageSize ?? DEFAULT_LIST_PAGE_SIZE,
    ...rest,
  });
}

type FetchListPageOptions = {
  pageSize?: number;
  /** Endpoint filters / sort forwarded unchanged to every page request. */
  params?: Readonly<Record<string, ListQueryParamValue>>;
};

/**
 * Fetches every page from a paginated list endpoint and returns a flat array.
 * Falls back to a plain array body when the server omits pagination metadata.
 */
export async function fetchAllListPages<T>(
  config: WorkOrdersApiConfig,
  path: string,
  options?: FetchListPageOptions,
): Promise<ApiOk<T[]> | ApiErr> {
  const pageSize = options?.pageSize ?? DEFAULT_LIST_PAGE_SIZE;

  const fetchPage = async (page: number) =>
    requestPage<T>(config, path, {
      ...options?.params,
      page,
      pageSize,
    });

  const first = await fetchPage(1);
  if (!first.ok) return first;

  const { items, totalPages } = first.data;
  if (totalPages <= 1) {
    return { ok: true, data: items };
  }

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)),
  );
  const combined = [...items];
  for (const pageResult of rest) {
    if (!pageResult.ok) return pageResult;
    combined.push(...pageResult.data.items);
  }

  return { ok: true, data: combined };
}
