"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import type { FinanceNavArea } from "@platform/app-shared/prototype/financial-nav";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { buildFinanceMyTasks } from "@financial/mfe";
import { bucketRevenueRows } from "@financial/mfe/lib/finance-revenue-stages";

/**
 * عدّادات السايدبار (قابل للإجراء فقط) — مهامي · الإيرادات · التكاليف.
 * مهامي = طول قائمة مهامي الفعلية (buildFinanceMyTasks) وليس مجموع تقريبي.
 */
export function useFinanceNavBadges(): Partial<Record<FinanceNavArea, number>> {
  const { hasCapability } = usePrototype();
  const enabled = hasCapability("manage-financial");

  const trackingQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking", "nav-badges"],
    queryFn: loadEnfazTracking,
    staleTime: 30_000,
    enabled,
  });

  const readyQuery = useQuery({
    queryKey: [
      ...prototypeKeys.all,
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
      ...prototypeKeys.all,
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

    // تكاليف: مستحقات + مسيرات/أوامر تحتاج عمل (مسودة، صادر، فاتورة واردة)
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
