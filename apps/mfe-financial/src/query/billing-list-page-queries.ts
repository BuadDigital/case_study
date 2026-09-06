"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingReadyLinesPage,
  loadPartyBillingStatement,
  loadPartyBillingStatementsPage,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { loadReadyEnfazPoSummariesPage } from "@platform/app-shared/app-data/enfaz-billing-api";
import type {
  EnfazReadyPoListQuery,
  PartyBillingReadyLineListQuery,
  PartyBillingStatementListQuery,
} from "@platform/api-client";

/** Rows per page on every finance list — the same window the PO list uses. */
export const FINANCE_LIST_PAGE_SIZE = 10;

const GC_MS = 10 * 60_000;
/** Server-filtered lists go stale sooner — a page flip must not show a stale window. */
const listPageDefaults = {
  staleTime: 20_000,
  gcTime: GC_MS,
  /** Keep the previous page on screen while the next one loads. */
  placeholderData: keepPreviousData,
};

/**
 * Page state that goes back to page 1 whenever the list's filters change —
 * pass the filters as one string key. Uses the render-time reset the finance
 * screens already use for their URL-driven tabs, so no effect fires a stale
 * page request.
 */
export function useListPageState(resetKey: string) {
  const [page, setPage] = useState(1);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setPage(1);
  }
  return [page, setPage] as const;
}

/** One server page of statements — pagination-contract §9.1. */
export function usePartyBillingStatementsPageQuery(
  query: PartyBillingStatementListQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: appDataKeys.partyBillingStatementsPage(query),
    queryFn: () => loadPartyBillingStatementsPage(query),
    enabled,
    ...listPageDefaults,
  });
}

/** One server page of ready dues — pagination-contract §9.2. */
export function usePartyBillingReadyLinesPageQuery(
  query: PartyBillingReadyLineListQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: appDataKeys.partyBillingReadyLinesPage(query),
    queryFn: () => loadPartyBillingReadyLinesPage(query),
    enabled,
    ...listPageDefaults,
  });
}

/**
 * One statement by id — for a deep-linked or just-created statement that is
 * not on the page the list is showing. Disabled without an id.
 */
export function usePartyBillingStatementQuery(statementId: string | null) {
  return useQuery({
    queryKey: appDataKeys.partyBillingStatement(statementId ?? ""),
    queryFn: () => loadPartyBillingStatement(statementId!),
    enabled: Boolean(statementId),
    staleTime: 20_000,
    gcTime: GC_MS,
  });
}

/** One server page of Enfaz-ready work orders — pagination-contract §10.1. */
export function useEnfazReadyPosPageQuery(query: EnfazReadyPoListQuery) {
  return useQuery({
    queryKey: appDataKeys.enfazReadyPosPage(query),
    queryFn: () => loadReadyEnfazPoSummariesPage(query),
    ...listPageDefaults,
  });
}
