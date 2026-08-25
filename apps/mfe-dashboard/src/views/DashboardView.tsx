"use client";

import { useMemo } from "react";
import type {
  ReportingCompletionYearDto,
  ReportingStageDwellDto,
} from "@platform/api-client";
import type { PoRow } from "@platform/app-shared/prototype/constants";
import { cn, ReportPageBody } from "@platform/ui-kit";
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
 * لوحة التحكم — مطابق لـ Case Study.html `renderDashboard()`.
 */
export function DashboardView() {
  const { data: poRows, isPending: poPending } = usePoListRowsQuery();
  const { data: opsTasks, isPending: tasksPending } =
    useDashboardOpsTasksQuery();
  const { data: failuresOpen = 0, isPending: failPending } =
    useDashboardOpenFailuresCountQuery();
  const { data: reporting, isPending: reportingPending } =
    useReportingDashboardQuery();

  const rows = poRows ?? EMPTY_PO_ROWS;
  const openTasks = useMemo(
    () => (opsTasks ?? []).filter((t) => isOpsTaskActive(t.status)),
    [opsTasks],
  );
  const activeOrders = useMemo(() => activePoOrders(rows), [rows]);
  const pending = poPending || tasksPending || failPending;

  const kpis = useMemo(
    () => buildDashKpis(rows, openTasks, failuresOpen),
    [rows, openTasks, failuresOpen],
  );
  const completion = useMemo(() => buildCompletion(rows), [rows]);

  return (
    <ReportPageBody className="gap-0">
      <DashKpiCards kpis={kpis} pending={pending} />
      <DashActivityFeed />
      <div className={cn(dashGrid, "mb-4")}>
        <DashActionQueue tasks={openTasks} />
        <DashDueSoonOrders orders={activeOrders} />
      </div>
      <div className={cn(dashGrid, "mb-4")}>
        <DashTrendCard
          years={reporting?.completionTrend ?? EMPTY_COMPLETION_TREND}
          pending={reportingPending}
        />
        <DashCompletionCard model={completion} pending={poPending} />
      </div>
      <DashDwellSlaCard
        rows={reporting?.stageDwell ?? EMPTY_STAGE_DWELL}
        pending={reportingPending}
      />
    </ReportPageBody>
  );
}
