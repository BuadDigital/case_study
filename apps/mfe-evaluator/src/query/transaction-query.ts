"use client";

import {
  linkedPropertyDeeds,
  type TransactionDeedDto,
} from "@platform/api-client";
import { useTransactionByPropertyQuery } from "@platform/app-shared/query/transaction-by-property-query";

const NO_DEEDS: TransactionDeedDto[] = [];

/**
 * Phase 5: the transaction a deed belongs to — the appraiser values the
 * whole linked property, so the window lists every deed. Same query as the case-study page.
 */
export { useTransactionByPropertyQuery };

/**
 * Phase 5: the live deeds of a linked property, for the report and the
 * appraiser's window.
 *
 * How it works: reads the deed's transaction (`useTransactionByPropertyQuery`, shared cache
 * with the case-study page) and passes it to `linkedPropertyDeeds`, which drops removed deeds
 * and returns them in transaction order only when two or more remain.
 *
 * Edge cases: an ordinary property, a deed with no transaction (404 → null) or a transaction
 * still loading → the same module-level empty array every render, so callbacks and memos that
 * depend on it (the report meta) do not rebuild for nothing.
 */
export function useLinkedPropertyDeeds(propertyId: string | null | undefined): TransactionDeedDto[] {
  const { data } = useTransactionByPropertyQuery(propertyId);
  const deeds = linkedPropertyDeeds(data);
  return deeds.length > 0 ? deeds : NO_DEEDS;
}
