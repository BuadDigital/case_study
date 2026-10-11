/**
 * A query that failed with nothing to show. React-query keeps the last good
 * `data` when a background refetch fails, so that case still renders rows;
 * only a load with no data at all swaps in `QueryErrorState`.
 *
 * Screens branch pending → failed → empty → rows, and KPI tiles show «—»
 * (not 0) while `!queryHasData(q)`.
 */
export function queryLoadFailed(query: {
  isError: boolean;
  data: unknown;
}): boolean {
  return query.isError && query.data === undefined;
}

/** True once the query holds data (fresh or kept from an earlier success). */
function queryHasData(query: { data: unknown }): boolean {
  return query.data !== undefined;
}
