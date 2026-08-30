"use client";

import { EmptyState, PageShell } from "@platform/ui-kit";
import { FinanceWorkspace } from "../components/FinanceWorkspace";
import { useFinancialSummaryQuery } from "../query/financial-queries";
import { finContent, finShell } from "../lib/finance-tw";

export function FinancialView() {
  const { isError } = useFinancialSummaryQuery();

  return (
    <PageShell variant="canvas" className={finShell}>
      <div className={finContent}>
        {isError ? (
          <EmptyState
            panel
            line="تعذر تحميل التقارير المالية."
            hint="تحقق من أن خادم المالية يعمل ثم أعد المحاولة."
          />
        ) : (
          <FinanceWorkspace />
        )}
      </div>
    </PageShell>
  );
}
