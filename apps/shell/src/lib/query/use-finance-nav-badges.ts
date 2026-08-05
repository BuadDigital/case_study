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

/**
 * عدّادات السايدبار (قابل للإجراء فقط) — مهامي · الإيرادات · التكاليف.
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

    // مراحل الإيراد القابلة للإجراء (نفس منطق bucket مُبسَّط)
    let revenue = 0;
    for (const row of tracking) {
      const work = (row.workStatus ?? "").toLowerCase();
      if (work === "cancelled" || work === "excluded") continue;
      if (work !== "done") continue;
      const inv = (row.invoiceStatus ?? "").toLowerCase();
      if (inv === "collected") continue;
      revenue += 1;
    }

    const openStmts = statements.filter(
      (s) =>
        s.status === "draft" ||
        s.status === "issued" ||
        s.status === "invoice_received",
    ).length;
    const costs = ready.length + openStmts;

    // مهامي ≈ مجموع الإجراءات (تقريبي؛ يُحسب أدق داخل MFE)
    const myTasks = revenue + costs;

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
