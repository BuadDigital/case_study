"use client";

import {
  EmptyState,
  ListPager,
  StatusPill,
  cn,
  finStatusStyle,
  opsLetterCard,
} from "@platform/ui-kit";
import type { EnfazReadyPoSummaryDto } from "@platform/api-client";
import { finPo, finRowActive } from "../lib/finance-tw";

/**
 * The «أوامر العمل الجاهزة» side list of the Enfaz billing screen — one
 * server page of ready work orders (pagination-contract §10.1) with the shared
 * pager underneath. Selection stays with the parent, which owns the detail.
 */
export function FinanceEnfazReadyPoList({
  summaries,
  totalCount,
  totalPages,
  page,
  pageSize,
  pending,
  selectedPo,
  onSelect,
  onPageChange,
}: {
  summaries: EnfazReadyPoSummaryDto[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pending: boolean;
  selectedPo: string | null;
  onSelect: (poNumber: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className={opsLetterCard}>
      <div className="border-b border-border px-3 py-2.5 text-[12px] font-semibold text-heading">
        أوامر العمل الجاهزة
        <StatusPill
          label={String(totalCount)}
          style={finStatusStyle("warning")}
          className="ms-2"
        />
      </div>
      {pending && summaries.length === 0 ? (
        <EmptyState panel line="جاري التحميل…" />
      ) : (
        summaries.map((summary) => (
          <button
            key={summary.poNumber}
            type="button"
            className={cn(
              "flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm transition-colors hover:bg-row-hover",
              selectedPo === summary.poNumber && finRowActive,
              selectedPo === summary.poNumber && "font-semibold",
            )}
            onClick={() => onSelect(summary.poNumber)}
          >
            <span className={finPo} dir="ltr">
              {summary.poNumber}
            </span>
            <span className="text-[11px] text-text-3">
              {summary.doneCount} مكتملة
              {summary.cancelledCount > 0
                ? ` · ${summary.cancelledCount} ملغاة`
                : ""}
            </span>
          </button>
        ))
      )}
      <ListPager
        className="border-t border-border px-3"
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        pending={pending && summaries.length === 0}
        onPageChange={onPageChange}
      />
    </div>
  );
}
