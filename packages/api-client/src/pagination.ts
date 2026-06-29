import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";
import { getApiBase } from "./index";

export const DEFAULT_LIST_PAGE_SIZE = 500;

export type PagedResultDto<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

export type FetchListPageOptions = {
  pageSize?: number;
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
  const base = (config.baseUrl ?? getApiBase()).replace(/\/$/, "");
  const pageSize = options?.pageSize ?? DEFAULT_LIST_PAGE_SIZE;

  const fetchPage = async (
    page: number,
  ): Promise<ApiOk<PagedResultDto<T>> | ApiErr> => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const url = `${base}${path}?${params}`;
    try {
      const res = await fetch(url, { headers: headers(config.token) });
      if (res.status === 401) return { ok: false, kind: "auth" };
      if (!res.ok) return { ok: false, kind: "server" };
      const data = (await res.json()) as PagedResultDto<T> | T[];
      if (Array.isArray(data)) {
        return {
          ok: true,
          data: {
            items: data,
            totalCount: data.length,
            page: 1,
            pageSize: data.length,
            totalPages: 1,
          },
        };
      }
      if (!isPagedResult<T>(data)) {
        return { ok: false, kind: "server" };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, kind: "network" };
    }
  };

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
