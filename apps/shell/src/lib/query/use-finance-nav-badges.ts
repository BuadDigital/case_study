"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadEnfazTracking } from "@platform/app-shared/app-data/enfaz-billing-api";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import type { FinanceNavArea } from "@platform/app-shared/app-data/financial-nav";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { buildFinanceMyTasks } from "@financial/mfe/lib/finance-my-tasks";
import { bucketRevenueRows } from "@financial/mfe/lib/finance-revenue-stages";

/**
 * Sidebar badges (actionable only) — My Tasks · Revenue · Costs.
 * My Tasks = length of the real My Tasks list (buildFinanceMyTasks), not an approximate sum.
 */
export function useFinanceNavBadges(): Partial<Record<FinanceNavArea, number>> {
  const { hasCapability } = useAppAccess();
  const enabled = hasCapability("manage-financial");

  const trackingQuery = useQuery({
    queryKey: [...appDataKeys.all, "enfaz-billing", "tracking", "nav-badges"],
    queryFn: loadEnfazTracking,
    staleTime: 30_000,
    enabled,
  });

  const readyQuery = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "ready-lines",
      "nav-badges",
    ],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 30_000,
    enabled,
  });

  const statementsQuery = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      "nav-badges",
    ],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 30_000,
    enabled,
  });

  return useMemo(() => {
    if (!enabled) return {};

    const tracking = trackingQuery.data ?? [];
    const ready = readyQuery.data ?? [];
    const statements = statementsQuery.data ?? [];

    const buckets = bucketRevenueRows(tracking);
    const revenue =
      buckets.eligible.length +
      buckets.billing_assistant.length +
      buckets.awaiting_collection.length +
      buckets.stopped.length;

    // Costs: dues + payrolls/orders needing work (draft, issued, inbound invoice)
    const openStmts = statements.filter(
      (s) =>
        s.status === "draft" ||
        s.status === "issued" ||
        s.status === "invoice_received",
    ).length;
    const costs = ready.length + openStmts;

    const myTasks = buildFinanceMyTasks({
      tracking,
      readyLines: ready,
      statements,
    }).length;

    return {
      tasks: myTasks > 0 ? myTasks : undefined,
      revenue: revenue > 0 ? revenue : undefined,
      costs: costs > 0 ? costs : undefined,
    };
  }, [
    enabled,
    trackingQuery.data,
    readyQuery.data,
    statementsQuery.data,
  ]);
}
