"use client";

import {
  EmptyState,
  OperationalPanel,
  PageShell,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatSub,
  StatValue,
} from "@platform/design-system";
import { FinanceWorkspace } from "../components/FinanceWorkspace";
import { useFinancialSummaryQuery } from "../query/financial-queries";

export function FinancialView() {
  const { data: summary, isPending, isError } = useFinancialSummaryQuery();
  const ready = !isPending && summary != null;

  const statCards = ready
    ? [
        <StatCard key="revenue" accent="blue">
          <StatLabel>إيرادات {summary.periodLabel}</StatLabel>
          <StatValue value={summary.revenueTotal} countUp />
          <StatSub>ريال سعودي</StatSub>
        </StatCard>,
        <StatCard key="costs" accent="red">
          <StatLabel>تكاليف خارجية</StatLabel>
          <StatValue value={summary.externalCostsTotal} countUp />
          <StatSub>مكاتب + متعاونون</StatSub>
        </StatCard>,
        <StatCard key="margin" accent="green">
          <StatLabel>هامش الربح</StatLabel>
          <StatValue value={summary.profitMarginTotal} countUp />
          <StatSub>{summary.profitMarginPercentLabel || "—"}</StatSub>
        </StatCard>,
        <StatCard key="pending" accent="warn">
          <StatLabel>مستحقات معلقة</StatLabel>
          <StatValue value={summary.pendingPayablesTotal} countUp />
          <StatSub>ريال سعودي</StatSub>
        </StatCard>,
      ]
    : Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ));

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <StatGrid cols={4}>{statCards}</StatGrid>

      <OperationalPanel className="min-h-0 flex-1 overflow-hidden p-0">
        {isError ? (
          <div className="p-4">
            <EmptyState
              line="تعذر تحميل التقارير المالية."
              hint="تحقق من أن خادم المالية يعمل ثم أعد المحاولة."
            />
          </div>
        ) : (
          <FinanceWorkspace summary={summary} ready={ready} />
        )}
      </OperationalPanel>
    </PageShell>
  );
}
