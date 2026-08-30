"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { cn } from "@platform/ui-kit";
import {
  buildFinanceMyTasks,
  buildFinanceMyTasksKpis,
  type FinanceMyTask,
} from "../lib/finance-my-tasks";
import { buildFinanceHref } from "../lib/finance-nav";

const FinanceDisbursementCloseModal = dynamic(
  () =>
    import("./FinanceDisbursementCloseModal").then(
      (m) => m.FinanceDisbursementCloseModal,
    ),
  { ssr: false },
);
const FinanceVendorInvoiceMatchModal = dynamic(
  () =>
    import("./FinanceVendorInvoiceMatchModal").then(
      (m) => m.FinanceVendorInvoiceMatchModal,
    ),
  { ssr: false },
);

// Bundle is fetched on hover/focus of the open button instead of waiting for click
// (bundle-preload).
const preloadDisbursementCloseModal = () =>
  void import("./FinanceDisbursementCloseModal");
const preloadVendorInvoiceMatchModal = () =>
  void import("./FinanceVendorInvoiceMatchModal");

const EMPTY_STATEMENTS: PartyBillingStatementDto[] = [];

/** Square KPI icon — finance-tw tokens */
function KpiIco({
  children,
  gold,
}: {
  children: ReactNode;
  gold?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px]",
        gold
          ? "bg-[#f1ece2] text-[#8c7857]"
          : "bg-[color-mix(in_srgb,#a4906f_12%,transparent)] text-[#102B4E]",
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

function DomainChip({ domain }: { domain: "revenue" | "costs" }) {
  const isRev = domain === "revenue";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[10px] font-bold",
        isRev
          ? "bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] text-[#2f7a4d]"
          : "bg-[color-mix(in_srgb,#102B4E_10%,transparent)] text-[#1f3a5f]",
      )}
    >
      {isRev ? "الإيرادات" : "التكاليف"}
    </span>
  );
}

function AgeBlock({
  days,
  note,
}: {
  days: number | null;
  note: string | null;
}) {
  if (days == null) {
    return <span className="text-[13px] text-[#a4a6ad]">—</span>;
  }
  const urgent = days >= 30;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "text-[18px] font-extrabold leading-none tabular-nums",
          urgent ? "text-[#a5432e]" : "text-[#102B4E]",
        )}
        dir="ltr"
      >
        {days}
      </span>
      {note ? (
        <span className="text-[10px] font-medium text-[#a4a6ad]" dir="ltr">
          {note}
        </span>
      ) : (
        <span className="text-[10px] text-[#a4a6ad]">يوم</span>
      )}
    </div>
  );
}

const gridCols =
  "min-w-[980px] grid-cols-[minmax(200px,1.7fr)_minmax(118px,1fr)_minmax(100px,0.85fr)_minmax(160px,1.25fr)_minmax(120px,1fr)_88px_minmax(110px,0.9fr)]";

function TaskRow({
  task,
  onOpen,
}: {
  task: FinanceMyTask;
  onOpen: (task: FinanceMyTask) => void;
}) {
  const opensModal =
    task.kind === "cost_match_invoice" || task.kind === "cost_close_statement";
  const preloadModal =
    task.kind === "cost_match_invoice"
      ? preloadVendorInvoiceMatchModal
      : preloadDisbursementCloseModal;

  return (
    <div
      className={cn(
        "grid min-h-[58px] items-center border-b border-[#ece8df] transition-colors duration-120 last:border-b-0 hover:bg-[#faf6ee]",
        gridCols,
      )}
    >
      <div className="flex min-w-0 flex-col items-start justify-center gap-1.5 px-4 py-3.5 text-start">
        <DomainChip domain={task.domain} />
        <span className="text-[12.5px] font-bold leading-snug text-[#102B4E]">
          {task.title}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-3 py-3.5 text-center">
        <span className="text-[13px] font-bold text-[#8c7857]" dir="ltr">
          {task.reference}
        </span>
        {task.subject && task.subject !== task.reference ? (
          <span
            className="max-w-full truncate text-[11px] text-[#a4a6ad]"
            title={task.subject}
          >
            {task.subject}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-center px-3 py-3.5">
        <span
          className="text-[14px] font-extrabold tabular-nums text-[#102B4E]"
          dir="ltr"
        >
          {fmtMax(task.amountSar)}
        </span>
      </div>
      <div className="flex items-center justify-center px-3 py-3.5 text-center">
        <span className="text-[11.5px] leading-[1.45] text-[#73767f]">
          {task.requirement}
        </span>
      </div>
      <div className="flex items-center justify-center px-3 py-3.5 text-center">
        <span className="text-[12px] font-semibold text-[#3a3f4d]">
          {task.movesTo}
        </span>
      </div>
      <div className="flex items-center justify-center px-2 py-3.5">
        <AgeBlock days={task.ageDays} note={task.ageNote} />
      </div>
      <div className="flex items-center justify-center px-3 py-3.5">
        {opensModal ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-bold text-[#3a3f4d] transition-colors hover:text-[#102B4E]"
            onClick={() => onOpen(task)}
            onMouseEnter={preloadModal}
            onFocus={preloadModal}
          >
            {task.openLabel}
            <span className="text-[14px] leading-none" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <Link
            href={task.href}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[#3a3f4d] no-underline transition-colors hover:text-[#102B4E]"
          >
            {task.openLabel}
            <span className="text-[14px] leading-none" aria-hidden>
              ›
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export function FinanceMyTasks() {
  const queryClient = useQueryClient();
  const [matchStatementId, setMatchStatementId] = useState<string | null>(
    null,
  );
  const [closeStatementId, setCloseStatementId] = useState<string | null>(
    null,
  );

  const trackingQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking", "my-tasks"],
    queryFn: loadEnfazTracking,
    staleTime: 20_000,
  });
  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "ready-lines", "my-tasks"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "my-tasks"],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 20_000,
  });

  const pending =
    trackingQuery.isPending ||
    readyQuery.isPending ||
    statementsQuery.isPending;

  const statements = statementsQuery.data ?? EMPTY_STATEMENTS;

  const tasks = useMemo(
    () =>
      buildFinanceMyTasks({
        tracking: trackingQuery.data ?? [],
        readyLines: readyQuery.data ?? [],
        statements,
      }),
    [trackingQuery.data, readyQuery.data, statements],
  );

  const kpi = useMemo(() => buildFinanceMyTasksKpis(tasks), [tasks]);

  const matchStatement = useMemo(
    () =>
      matchStatementId
        ? (statements.find((s) => s.id === matchStatementId) ?? null)
        : null,
    [matchStatementId, statements],
  );

  const closeStatement = useMemo(
    () =>
      closeStatementId
        ? (statements.find((s) => s.id === closeStatementId) ?? null)
        : null,
    [closeStatementId, statements],
  );

  const handleOpen = useCallback((task: FinanceMyTask) => {
    if (task.kind === "cost_match_invoice" && task.statementId) {
      setMatchStatementId(task.statementId);
      return;
    }
    if (task.kind === "cost_close_statement" && task.statementId) {
      setCloseStatementId(task.statementId);
    }
  }, []);

  const invalidateBilling = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "party-billing"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      }),
    ]);
  }, [queryClient]);

  const goToCostsAfterMatch = useCallback((s: PartyBillingStatementDto) => {
    setMatchStatementId(null);
    const party =
      s.assigneeId?.trim() ||
      statements.find((x) => x.id === s.id)?.assigneeId?.trim() ||
      null;
    // Full navigation — soft router.push sometimes left the screen on My Tasks.
    window.location.assign(
      buildFinanceHref({
        area: "costs",
        section: "statements",
        statement: s.id,
        party,
      }),
    );
  }, [statements]);

  const closeMatchModal = useCallback(() => setMatchStatementId(null), []);
  const closeCloseModal = useCallback(() => setCloseStatementId(null), []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap overflow-hidden rounded-xl border border-[#ece8df] bg-white shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
        <div className="relative min-w-[160px] flex-1 border-e border-[#ece8df] px-6 py-5 last:border-e-0 before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-[#a4906f] before:content-['']">
          <div className="mb-3.5 flex items-center gap-2.5">
            <KpiIco>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </KpiIco>
            <span className="text-[12.5px] font-medium text-[#73767f]">
              بانتظار المطابقة
            </span>
          </div>
          <div
            className="text-end text-[32px] font-extrabold leading-none text-[#102B4E]"
            dir="ltr"
          >
            {kpi.matchCount}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-[#a4a6ad]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a4906f]" />
            من الإيرادات
          </div>
        </div>

        <div className="min-w-[160px] flex-1 border-e border-[#ece8df] px-6 py-5 last:border-e-0">
          <div className="mb-3.5 flex items-center gap-2.5">
            <KpiIco gold>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" strokeLinecap="round" />
              </svg>
            </KpiIco>
            <span className="text-[12.5px] font-medium text-[#73767f]">
              فواتير بانتظار التحصيل
            </span>
          </div>
          <div
            className="text-end text-[32px] font-extrabold leading-none text-[#102B4E]"
            dir="ltr"
          >
            {kpi.collectCount}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-[#a4a6ad]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a4906f]" />
            <span dir="ltr">{fmtMax(kpi.collectAmountSar)}</span>
            <span>ر.س</span>
          </div>
        </div>

        <div className="min-w-[160px] flex-1 border-e border-[#ece8df] px-6 py-5 last:border-e-0">
          <div className="mb-3.5 flex items-center gap-2.5">
            <KpiIco>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                <path d="M14 2v6h6" strokeLinejoin="round" />
              </svg>
            </KpiIco>
            <span className="text-[12.5px] font-medium text-[#73767f]">
              مستندات قيد الإجراء
            </span>
          </div>
          <div
            className="text-end text-[32px] font-extrabold leading-none text-[#102B4E]"
            dir="ltr"
          >
            {kpi.docsCount}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-[#a4a6ad]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a4906f]" />
            من التكاليف
          </div>
        </div>

        <div className="min-w-[160px] flex-1 border-e border-[#ece8df] px-6 py-5 last:border-e-0">
          <div className="mb-3.5 flex items-center gap-2.5">
            <KpiIco>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </KpiIco>
            <span className="text-[12.5px] font-medium text-[#73767f]">
              بانتظار توثيق الصرف
            </span>
          </div>
          <div
            className="text-end text-[32px] font-extrabold leading-none text-[#102B4E]"
            dir="ltr"
          >
            {kpi.closeCount}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-[#a4a6ad]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a4906f]" />
            سند + مرجع + إيصال
          </div>
        </div>
      </div>

      <p className="m-0 mb-3.5 rounded-[10px] border border-dashed border-[#ddd8cc] bg-[#faf8f3] px-3.5 py-3 text-[12.5px] leading-[1.65] text-[#a4a6ad]">
        كل ما يتطلب إجراءً من المالية في مكان واحد — إيرادات وتكاليف. مطابقة
        فاتورة المورّد تُفتح هنا؛ بعد الإقرار يخرج المسير من مهامي ويُكمل توثيق
        الصرف من التكاليف.
      </p>

      {pending ? (
        <div className="overflow-hidden rounded-xl border border-[#ece8df] bg-white shadow-[0_1px_2px_rgba(18,40,76,0.03)]">
          <div className="px-5 py-[54px] text-center text-[14px] font-bold text-[#73767f]">
            جاري التحميل…
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#ece8df] bg-white shadow-[0_1px_2px_rgba(18,40,76,0.03)]">
          <div className="px-5 py-[54px] text-center">
            <div className="text-sm font-bold text-[#73767f]">
              لا إجراءات معلّقة — كل شيء مُحدَّث
            </div>
            <div className="mt-1 text-[13px] text-[#a4a6ad]">
              تظهر هنا مطابقة إنفاذ، تسجيل الفواتير والتحصيل، ومسيرات الصرف.
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#ece8df] bg-white shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <div
              className={cn(
                "grid sticky top-0 z-[3] border-b-2 border-[#a4906f] bg-[#faf8f3]",
                gridCols,
              )}
            >
              {[
                "الإجراء المطلوب",
                "المرجع",
                "المبلغ ر.س",
                "ما يلزم لإتمامه",
                "ينتقل إلى",
                "العمر يوم",
                "انتقال",
              ].map((h, i) => (
                <div
                  key={h}
                  className={cn(
                    "flex min-w-0 items-center overflow-hidden px-3.5 py-[13px] text-[12px] font-bold whitespace-nowrap text-[#102B4E]",
                    i === 0
                      ? "justify-start text-start"
                      : "justify-center text-center",
                  )}
                >
                  {h}
                </div>
              ))}
            </div>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={handleOpen} />
            ))}
          </div>
        </div>
      )}

      {/* Conditional mount — always mounting fetched both modal chunks on screen open
          despite code-splitting (bundle-conditional). */}
      {matchStatementId ? (
        <FinanceVendorInvoiceMatchModal
          open={Boolean(matchStatementId)}
          statement={matchStatement}
          onClose={closeMatchModal}
          onDone={invalidateBilling}
          onMatched={goToCostsAfterMatch}
        />
      ) : null}
      {closeStatementId ? (
        <FinanceDisbursementCloseModal
          open={Boolean(closeStatementId)}
          statement={closeStatement}
          onClose={closeCloseModal}
          onDone={invalidateBilling}
        />
      ) : null}
    </div>
  );
}
