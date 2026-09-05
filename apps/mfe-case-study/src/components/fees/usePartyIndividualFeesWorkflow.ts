"use client";

/**
 * All non-rendering workflow behind `PartyIndividualFeesHtmlScreen`: the ledger
 * / visit-fee / statement queries, tab + filter state, and the fee transition
 * write. The screen consumes the returned bag and keeps JSX only; pure rules
 * live in `party-individual-fees-state.ts`.
 */
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listKeyEnvelopeFeeReport } from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import type {
  InspectorFeeAction,
  InspectorFeeRowDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { runInspectorFeeTransition } from "@platform/app-shared/app-data/inspector-fees-api";
import { loadPartyBillingStatements } from "@platform/app-shared/app-data/party-billing-statements-api";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { useCourtVisitFeesQuery } from "../../query/operations-tasks-queries";
import {
  actionFeeRows,
  COPY,
  filterFeeRows,
  filterStatements,
  individualFeeUiStatus,
  individualFeesKpi,
  isIndividualPartyFeeLaneRow,
  ownLaneStatements,
  readyFeeRows,
  trackingFeeRows,
  type IndividualFeesVariant,
  type TabId,
} from "./party-individual-fees-state";

export function usePartyIndividualFeesWorkflow(
  assigneeId: string | undefined,
  variant: IndividualFeesVariant,
) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const copy = COPY[variant];
  const isCourtVisit = variant === "court-visit";
  const showVisitKey = isCourtVisit;

  const [tab, setTab] = useState<TabId>(isCourtVisit ? "visit-fees" : "action");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [stFilter, setStFilter] = useState("");
  const [fnSearch, setFnSearch] = useState("");
  const [openFn, setOpenFn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inspector: ledger path. Reviewer: CourtVisitFeeCharges only (no court-visit taskKind on the ledger).
  const { data: summary, isPending: feesPending } = useInspectorFeesQuery(
    {
      assigneeId,
      submittedOnly: false,
      taskKind: "field-inspection",
    },
    { enabled: Boolean(assigneeId) && variant === "field-inspection" },
  );

  const { data: visitFees = [] } = useCourtVisitFeesQuery({
    creditAssigneeId: assigneeId,
    enabled: Boolean(assigneeId) && isCourtVisit,
  });

  const { data: keyFeesCount = 0 } = useQuery({
    queryKey: [...appDataKeys.keyEnvelopeFees(), "nav-count", "individual"],
    queryFn: async () => {
      const config = prototypeModulesApiConfig();
      if (!config) return 0;
      const result = await listKeyEnvelopeFeeReport(config);
      return result.ok ? result.data.length : 0;
    },
    enabled: showVisitKey,
    staleTime: 30_000,
  });

  const rows = useMemo(
    () =>
      variant === "field-inspection"
        ? sortInspectorFeeRowsNewestFirst(summary?.rows ?? []).filter(
            isIndividualPartyFeeLaneRow,
          )
        : [],
    [summary?.rows, variant],
  );

  const { data: statementsRaw = [] } = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? "none",
      "issued+",
      variant,
      "individual-lane",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: Boolean(assigneeId),
  });

  const statements = useMemo(
    () => ownLaneStatements(statementsRaw, variant),
    [statementsRaw, variant],
  );

  const kpi = useMemo(
    () => individualFeesKpi({ rows, statements, visitFees, isCourtVisit }),
    [rows, statements, isCourtVisit, visitFees],
  );

  const actionRows = useMemo(() => actionFeeRows(rows), [rows]);
  const trackingRows = useMemo(() => trackingFeeRows(rows), [rows]);
  const readyRows = useMemo(() => readyFeeRows(rows), [rows]);

  const feeBucketRows =
    tab === "action"
      ? actionRows
      : tab === "tracking"
        ? trackingRows
        : tab === "ready"
          ? readyRows
          : [];

  const filteredFees = useMemo(
    () => filterFeeRows(feeBucketRows, deferredSearch, stFilter),
    [feeBucketRows, deferredSearch, stFilter],
  );

  const filteredFns = useMemo(
    () => filterStatements(statements, fnSearch),
    [statements, fnSearch],
  );

  const invalidate = useCallback(async () => {
    // Two independent keys — in parallel (async-parallel).
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "inspector-fees"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "party-billing"],
      }),
    ]);
  }, [queryClient]);

  const act = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
      });
      if (!result.ok) {
        showToast(
          result.error || "تعذّر تنفيذ الإجراء — حاول مرة أخرى",
          "error",
        );
        return;
      }
      showToast(
        action === "submit-to-supervisor"
          ? "رُفع للمشرف بنجاح"
          : "تم تنفيذ الإجراء",
        "success",
      );
      await invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const onTabChange = (id: string) => {
    setTab(id as TabId);
    setSearch("");
    setStFilter("");
    setFnSearch("");
  };

  const tabs = isCourtVisit
    ? [
        {
          id: "visit-fees" as const,
          label: "أتعاب الزيارة",
          count: visitFees.filter((r) => r.status !== "settled").length,
        },
        {
          id: "statements" as const,
          label: copy.statementsLabel,
          count: statements.length,
        },
        {
          id: "key-fees" as const,
          label: "أتعاب استلام المفاتيح",
          count: keyFeesCount,
        },
      ]
    : [
        {
          id: "action",
          label: "رفع للمشرف",
          count: actionRows.length,
          countWarnWhenActive: true,
        },
        {
          id: "tracking",
          label: "قيد الإجراء",
          count: trackingRows.length,
        },
        {
          id: "ready",
          label: "لدى المالية",
          count: readyRows.filter((r) => {
            const st = individualFeeUiStatus(r);
            return st === "at_finance" || st === "listed";
          }).length,
        },
        {
          id: "statements",
          label: copy.statementsLabel,
          count: statements.length,
        },
      ];

  return {
    copy,
    isCourtVisit,
    showVisitKey,
    tab,
    tabs,
    onTabChange,
    search,
    setSearch,
    stFilter,
    setStFilter,
    fnSearch,
    setFnSearch,
    openFn,
    setOpenFn,
    busyId,
    feesPending,
    filteredFees,
    filteredFns,
    kpi,
    act,
    showToast,
  };
}
