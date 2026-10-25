"use client";

import {
  linkedPropertyDeeds,
  type TransactionDeedDto,
} from "@platform/api-client";
import { useTransactionByPropertyQuery } from "@platform/app-shared/query/transaction-by-property-query";

const NO_DEEDS: TransactionDeedDto[] = [];

/**
 * Phase 5 (decision 2026-10-19): the transaction a deed belongs to — the appraiser values the
 * whole linked property, so the window lists every deed. Same query as the case-study page.
 */
export { useTransactionByPropertyQuery };

/** The live deeds of a linked property; a stable empty list for an ordinary property. */
export function useLinkedPropertyDeeds(propertyId: string | null | undefined): TransactionDeedDto[] {
  const { data } = useTransactionByPropertyQuery(propertyId);
  const deeds = linkedPropertyDeeds(data);
  return deeds.length > 0 ? deeds : NO_DEEDS;
}
