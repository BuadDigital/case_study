/** Default page window when the device pages a downloaded list itself. */
const OFFLINE_PAGE_SIZE = 25;

export type OfflineListPage<T> = {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * One page of a list the device holds offline — the same shape a server page has,
 * so paged screens keep working from the downloaded copy.
 */
export function offlineListPage<T>(
  rows: readonly T[],
  query: { page?: number; pageSize?: number },
): OfflineListPage<T> {
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : OFFLINE_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
    totalPages,
  };
}
