"use client";

import { useMemo } from "react";
import type {
  ReportingCompletionYearDto,
  ReportingStageDwellDto,
} from "@platform/api-client";
import type { PoRow } from "@platform/app-shared/app-data/constants";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canReadCaseStudyWorkspace } from "@platform/app-shared/app-data/runtime-access";
import { cn, QueryErrorState, ReportPageBody } from "@platform/ui-kit";
import { DashActionQueue } from "../components/dashboard/DashActionQueue";
import { DashActivityFeed } from "../components/dashboard/DashActivityFeed";
import { DashCompletionCard } from "../components/dashboard/DashCompletionCard";
import { DashDueSoonOrders } from "../components/dashboard/DashDueSoonOrders";
import { DashDwellSlaCard } from "../components/dashboard/DashDwellSlaCard";
import { DashKpiCards } from "../components/dashboard/DashKpiCards";
import { DashTrendCard } from "../components/dashboard/DashTrendCard";
import {
  activePoOrders,
  buildCompletion,
  buildDashKpis,
  isOpsTaskActive,
} from "../lib/dashboard-metrics";
import { dashGrid } from "../lib/dashboard-tw";
import {
  useDashboardOpenFailuresCountQuery,
  useDashboardOpsTasksQuery,
  usePoListRowsQuery,
  useReportingDashboardQuery,
} from "../query/dashboard-queries";

const EMPTY_PO_ROWS: PoRow[] = [];
const EMPTY_COMPLETION_TREND: ReportingCompletionYearDto[] = [];
const EMPTY_STAGE_DWELL: ReportingStageDwellDto[] = [];

/**
 * Dashboard — matches Case Study.html `renderDashboard()`.
 */
export function DashboardView() {
  const { capabilities } = useAppAccess();
  // Finance reads the reporting snapshot but not work orders (API 403) — the
  // PO-derived cards are left out for it instead of showing «—» as a failure.
  const readsWorkOrders = canReadCaseStudyWorkspace(capabilities);
  const poQuery = usePoListRowsQuery(readsWorkOrders);
  const tasksQuery = useDashboardOpsTasksQuery();
  const failuresQuery = useDashboardOpenFailuresCountQuery();
  const reportingQuery = useReportingDashboardQuery();
  const { data: poRows, isPending: poPending } = poQuery;
  const { data: opsTasks, isPending: tasksPending } = tasksQuery;
  const { data: failuresOpen = 0, isPending: failPending } = failuresQuery;
  const { data: reporting, isPending: reportingPending } = reportingQuery;

  // A failed source shows «—» / «تعذّر التحميل», never 0 or «لا توجد».
  const poFailed = queryLoadFailed(poQuery);
  const tasksFailed = queryLoadFailed(tasksQuery);
  const reportingFailed = queryLoadFailed(reportingQuery);
  const kpisFailed = poFailed || tasksFailed || queryLoadFailed(failuresQuery);
  const failedQueries = [poQuery, tasksQuery, failuresQuery, reportingQuery].filter(
    queryLoadFailed,
  );
  const retrying = failedQueries.some((q) => q.isFetching);

  const rows = poRows ?? EMPTY_PO_ROWS;
  const openTasks = useMemo(
    () => (opsTasks ?? []).filter((t) => isOpsTaskActive(t.status)),
    [opsTasks],
  );
  const activeOrders = useMemo(() => activePoOrders(rows), [rows]);
  const pending = (readsWorkOrders && poPending) || tasksPending || failPending;

  const kpis = useMemo(
    () => buildDashKpis(rows, openTasks, failuresOpen),
    [rows, openTasks, failuresOpen],
  );
  const completion = useMemo(() => buildCompletion(rows), [rows]);

  return (
    <ReportPageBody className="gap-0">
      {failedQueries.length ? (
        <QueryErrorState
          className="mb-4 rounded-[12px] border border-border bg-surface"
          line="تعذّر تحميل بعض أرقام اللوحة"
          hint="الخانات التي لم تُحمَّل تظهر «—»."
          onRetry={() => {
            for (const q of failedQueries) void q.refetch();
          }}
          retrying={retrying}
        />
      ) : null}
      {readsWorkOrders ? (
        <DashKpiCards kpis={kpis} pending={pending || kpisFailed} />
      ) : null}
      <DashActivityFeed />
      <div className={cn(dashGrid, "mb-4")}>
        <DashActionQueue tasks={openTasks} failed={tasksFailed} />
        {readsWorkOrders ? (
          <DashDueSoonOrders orders={activeOrders} failed={poFailed} />
        ) : null}
      </div>
      <div className={cn(dashGrid, "mb-4")}>
        <DashTrendCard
          years={reporting?.completionTrend ?? EMPTY_COMPLETION_TREND}
          pending={reportingPending || reportingFailed}
        />
        {readsWorkOrders ? (
          <DashCompletionCard model={completion} pending={poPending || poFailed} />
        ) : null}
      </div>
      <DashDwellSlaCard
        rows={reporting?.stageDwell ?? EMPTY_STAGE_DWELL}
        pending={reportingPending || reportingFailed}
      />
    </ReportPageBody>
  );
}
