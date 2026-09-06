"use client";

/**
 * Enfaz work-order billing — match fees, save, issue the invoice, record the
 * collection. Thin composition: the workflow lives in
 * `useFinanceEnfazPoBillingWorkflow`, the regions in `FinanceEnfazBilling*`
 * and the ready-list in `FinanceEnfazReadyPoList`.
 */

import type { PoEnfazBillingDto } from "@platform/api-client";
import {
  EmptyState,
  StatusPill,
  cn,
  finStatusStyle,
  opsBtnGhost,
  opsLetterCard,
  opsTfNote,
} from "@platform/ui-kit";
import { invoiceHeaderPill } from "../lib/finance-enfaz-po-billing-state";
import { finPo, finWorkTitle } from "../lib/finance-tw";
import { FINANCE_LIST_PAGE_SIZE } from "../query/billing-list-page-queries";
import { FinanceEnfazBillingActions } from "./FinanceEnfazBillingActions";
import { FinanceEnfazBillingLinesTable } from "./FinanceEnfazBillingLinesTable";
import { FinanceEnfazBillingSummary } from "./FinanceEnfazBillingSummary";
import { FinanceEnfazReadyPoList } from "./FinanceEnfazReadyPoList";
import { useFinanceEnfazPoBillingWorkflow } from "./useFinanceEnfazPoBillingWorkflow";

function BillingErrorNote({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <p className={cn(opsTfNote, "mb-0")}>
      {error instanceof Error
        ? error.message
        : "تعذّر تحميل بيانات الفوترة — حاول مرة أخرى"}{" "}
      <button
        type="button"
        className={cn(opsBtnGhost, "ms-2")}
        onClick={onRetry}
      >
        إعادة المحاولة
      </button>
    </p>
  );
}

function BillingHeader({
  poNumber,
  billing,
}: {
  poNumber: string;
  billing: PoEnfazBillingDto;
}) {
  const pill = invoiceHeaderPill(billing);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className={cn(finWorkTitle, finPo)} dir="ltr">
        {poNumber}
      </h3>
      <StatusPill label={pill.label} style={finStatusStyle(pill.tone)} />
    </div>
  );
}

export function FinanceEnfazPoBilling({
  initialPo = null,
  compact = false,
}: {
  /** Opens a specific work order (from My Tasks / revenue list). */
  initialPo?: string | null;
  /** Hides the side work-order list when working from a stage. */
  compact?: boolean;
} = {}) {
  const wf = useFinanceEnfazPoBillingWorkflow({ initialPo, compact });

  if (wf.showReadyEmptyState) {
    return (
      <div className={opsLetterCard}>
        <EmptyState
          panel
          line="لا أوامر عمل جاهزة للفوترة."
          hint="يظهر أمر العمل هنا فقط بعد اكتمال كل معاملاته (مكتملة أو ملغاة)."
        />
      </div>
    );
  }

  const errorNote = wf.isError ? (
    <BillingErrorNote error={wf.error} onRetry={() => void wf.refetch()} />
  ) : null;

  const detailPanel = (
    <div className="min-w-0">
      {!wf.selectedPo || wf.isPending ? (
        <EmptyState panel line="اختر أمر عمل من القائمة." />
      ) : !wf.billing ? (
        <EmptyState panel line="تعذر تحميل بيانات الفوترة." />
      ) : (
        <div className="flex flex-col gap-3">
          <BillingHeader poNumber={wf.selectedPo} billing={wf.billing} />

          <FinanceEnfazBillingLinesTable
            lines={wf.billing.lines}
            draft={wf.draft}
            issued={wf.issued}
            onPatch={wf.patchDraft}
          />

          <FinanceEnfazBillingSummary
            billing={wf.billing}
            totals={wf.totals}
            issued={wf.issued}
            onOpenAttachment={wf.openAttachment}
          />

          <FinanceEnfazBillingActions
            issued={wf.issued}
            fullyCollected={wf.fullyCollected}
            canIssue={wf.billing.poReadyForBilling}
            total={wf.totals.total}
            commandBusy={wf.commandBusy}
            collectAmount={wf.collectAmount}
            remaining={wf.remaining}
            onCollectAmountChange={wf.setCollectAmount}
            onSave={() => void wf.save()}
            onIssue={() => void wf.issueInvoice()}
            onCollect={() => void wf.collect()}
            onDownloadPdf={() => void wf.downloadPdf()}
          />

          {!compact ? (
            <p className="m-0 text-xs text-text-3">
              المعاملات الملغاة لا تُفوتر. أتعاب المفاتيح شاملة الضريبة
              عند وجود استحقاق ظرف. التحصيل على الفاتورة يقفل معاملاتها.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {errorNote}
        {detailPanel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={cn(opsTfNote, "mb-0")}>
        المسار: اختر أمر عمل ← طابِق الأتعاب (تقييم + رفع + مفاتيح) ← احفظ ←
        سجّل الفاتورة ← سجّل التحويل.
      </p>

      {errorNote}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,0.9fr)_1.6fr]">
        <FinanceEnfazReadyPoList
          summaries={wf.ready.summaries}
          totalCount={wf.ready.totalCount}
          totalPages={wf.ready.totalPages}
          page={wf.ready.page}
          pageSize={FINANCE_LIST_PAGE_SIZE}
          pending={wf.ready.pending}
          selectedPo={wf.selectedPo}
          onSelect={wf.setSelectedPo}
          onPageChange={wf.ready.setPage}
        />

        {detailPanel}
      </div>
    </div>
  );
}
