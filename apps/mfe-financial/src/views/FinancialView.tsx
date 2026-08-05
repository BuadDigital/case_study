"use client";

import { PageShell } from "@platform/design-system";
import { FinanceWorkspace } from "../components/FinanceWorkspace";
import { useFinancialSummaryQuery } from "../query/financial-queries";
import {
  finContent,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finShell,
} from "../lib/finance-tw";

export function FinancialView() {
  const { data: summary, isPending, isError } = useFinancialSummaryQuery();
  const ready = !isPending && summary != null;

  return (
    <PageShell variant="canvas" className={finShell}>
      <div className={finContent}>
        {isError ? (
          <div className={finEmpty}>
            <div className={finEmptyT}>تعذر تحميل التقارير المالية.</div>
            <div className={finEmptyS}>
              تحقق من أن خادم المالية يعمل ثم أعد المحاولة.
            </div>
          </div>
        ) : (
          <FinanceWorkspace summary={summary} ready={ready} />
        )}
      </div>
    </PageShell>
  );
}
