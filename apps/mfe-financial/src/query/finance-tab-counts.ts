"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { bucketRevenueRows } from "../lib/finance-revenue-stages";
import { buildFinanceMyTasks } from "../lib/finance-my-tasks";

export function useFinanceTabCounts() {
  const trackingQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking", "counts"],
    queryFn: loadEnfazTracking,
    staleTime: 30_000,
  });

  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "ready-lines", "counts"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 30_000,
  });

  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "counts"],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 30_000,
  });

  const feesQuery = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "excluded-counts"],
    queryFn: () => loadInspectorFeesSummary({ submittedOnly: false }),
    staleTime: 60_000,
  });

  const tracking = trackingQuery.data ?? [];
  const readyLines = readyQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const feeRows = feesQuery.data?.rows ?? [];

  const buckets = useMemo(() => bucketRevenueRows(tracking), [tracking]);

  const revenueActionable =
    buckets.eligible.length +
    buckets.billing_assistant.length +
    buckets.awaiting_collection.length +
    buckets.stopped.length;

  const duesReady = readyLines.length;
  const statementsOpen = statements.filter(
    (s) =>
      s.status === "draft" ||
      s.status === "issued" ||
      s.status === "invoice_received",
  ).length;
  const costsActionable = duesReady + statementsOpen;

  const excludedCount =
    feeRows.filter(
      (r) =>
        r.excludedFromBatch ||
        (r.netFeeSar === 0 && r.workStatus === "done"),
    ).length + statements.filter((s) => s.status === "cancelled").length;

  const myTasks = useMemo(
    () =>
      buildFinanceMyTasks({
        tracking,
        readyLines,
        statements,
      }).length,
    [tracking, readyLines, statements],
  );

  return {
    isPending:
      trackingQuery.isPending ||
      readyQuery.isPending ||
      statementsQuery.isPending,
    myTasks,
    revenueActionable,
    costsActionable,
    duesReady,
    statementsOpen,
    excludedCount,
    /** توافق خلفي — لبعض الروابط القديمة */
    enfazReady: revenueActionable,
    engReady: costsActionable,
  };
}
