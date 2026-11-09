"use client";

/**
 * Failures queue — thin composition over the region components and
 * `useFailuresViewWorkflow`. Pure decisions live in `lib/failures-view-state.ts`;
 * the paged rows come from `useFailuresListPage`.
 */

import { useRef } from "react";
import {
  Button,
  ListPager,
  Note,
  OperationalPanel,
  PageShell,
  QueueTableHint,
  useSwapAnimation,
} from "@platform/ui-kit";
import { FinalFailureDialog } from "../components/failures/FinalFailureDialog";
import { failureDeedCell } from "../lib/failures-view-state";
import { FailuresViewKpiBand } from "./FailuresViewKpiBand";
import { FailuresViewMobileCards } from "./FailuresViewMobileCards";
import { FailuresViewTable } from "./FailuresViewTable";
import { FailuresViewToolbar } from "./FailuresViewToolbar";
import { useFailuresViewWorkflow } from "./useFailuresViewWorkflow";

export function FailuresView() {
  const wf = useFailuresViewWorkflow();
  const rowsRef = useRef<HTMLDivElement>(null);
  // Keyed on the tab and page whose rows are shown — never on search keystrokes.
  useSwapAnimation(rowsRef, wf.rowsPage);

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
      {wf.isError ? (
        <Note tone="warn" className="mb-0">
          {wf.error instanceof Error
            ? wf.error.message
            : "تعذّر تحميل التعذّرات — حاول مرة أخرى"}
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              showActionToast={false}
              onClick={() => void wf.refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        </Note>
      ) : null}

      <FailuresViewKpiBand stats={wf.stats} isFetched={wf.isFetched} />

      <FailuresViewToolbar wf={wf} />

      <OperationalPanel className="shrink-0 overflow-visible max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none">
        <div ref={rowsRef} id="failures-tab-panel">
          <FailuresViewTable wf={wf} />
          <FailuresViewMobileCards wf={wf} />
        </div>
      </OperationalPanel>

      <ListPager ready={wf.isFetched} {...wf.pager} onPageChange={wf.setPage} />

      {wf.finalFailure ? (
        <FinalFailureDialog
          key={wf.finalFailure.id}
          open
          onClose={wf.closeFinalFailure}
          poNumber={wf.finalFailure.poNumber}
          propertyId={wf.finalFailure.propertyId}
          deedLabel={
            wf.finalFailure.transactionNumber || failureDeedCell(wf.finalFailure)
          }
          deedCount={wf.finalFailure.transactionDeedCount}
          askProblemType={false}
          onDone={() => void wf.refetch()}
        />
      ) : null}

      <QueueTableHint className="hidden lg:block">
        اضغط الصف لفتح التفاصيل والإجراءات. سجّل تعذّراً جديداً من شاشة العقار
        (⋮ → إبلاغ عن تعذّر).
      </QueueTableHint>
    </PageShell>
  );
}
