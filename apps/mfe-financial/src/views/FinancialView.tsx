"use client";

import {
  EmptyState,
  OperationalPanel,
  PageShell,
} from "@platform/design-system";
import { FinanceWorkspace } from "../components/FinanceWorkspace";
import { useFinancialSummaryQuery } from "../query/financial-queries";

export function FinancialView() {
  const { data: summary, isPending, isError } = useFinancialSummaryQuery();
  const ready = !isPending && summary != null;

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
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
