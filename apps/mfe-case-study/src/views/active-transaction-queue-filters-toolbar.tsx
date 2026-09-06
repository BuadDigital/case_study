"use client";

/**
 * Filter strip above the active-transaction queue tables: search, the
 * status/type selects, the party-queue "show completed" eye, the all-transactions
 * group-by-PO toggle and the result-count chip. Presentation only — the screen owns
 * every value and handler.
 */
import {
  cn,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageToolbar,
  ShowAllEye,
  useShowAllEyeBlink,
} from "@platform/ui-kit";

const TOGGLE_BUTTON_ON = "border-ink bg-ink text-white";
const TOGGLE_BUTTON_OFF =
  "border-border-md bg-surface text-text-2 hover:bg-surface-2";

function GroupByPoIcon({
  groupByPo,
  groupGatherAnim,
}: {
  groupByPo: boolean;
  groupGatherAnim: boolean;
}) {
  return (
    <span
      className="relative inline-grid size-[15px] shrink-0 place-items-center"
      aria-hidden
    >
      {/* Animate the icon wrapper — keep the svg itself static so its paths
          are not redrawn every transition frame (rendering-animate-svg-wrapper). */}
      <span
        className={cn(
          "col-start-1 row-start-1 grid size-[15px] place-items-center transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none",
          groupByPo
            ? "-translate-y-0.5 scale-[0.86] opacity-0"
            : "scale-100 opacity-100",
        )}
      >
        <svg
          className="size-[15px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </svg>
      </span>
      <span
        className={cn(
          "col-start-1 row-start-1 grid size-[15px] place-items-center transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          groupByPo
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-0.5 scale-[0.86] opacity-0",
          groupByPo &&
            groupGatherAnim &&
            "animate-[atq-ico-pop_0.38s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none",
        )}
      >
        <svg
          className="size-[15px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7h16" />
          <path d="M6 12h12" />
          <path d="M8 17h8" />
        </svg>
      </span>
    </span>
  );
}

export function QueueFiltersToolbar({
  queueReady,
  isPartyQueueToggleTable,
  isPropertyAppraisalTable,
  isDistributionTable,
  isAllTransactionsTable,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  typeFilter,
  onTypeFilterChange,
  assignmentTypes,
  showCompleted,
  onToggleShowCompleted,
  groupByPo,
  groupGatherAnim,
  onToggleGroupByPo,
  filteredCount,
}: {
  queueReady: boolean;
  isPartyQueueToggleTable: boolean;
  isPropertyAppraisalTable: boolean;
  isDistributionTable: boolean;
  isAllTransactionsTable: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusOptions: string[];
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  assignmentTypes: string[];
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  groupByPo: boolean;
  groupGatherAnim: boolean;
  onToggleGroupByPo: () => void;
  filteredCount: number;
}) {
  const { blink: showAllEyeBlink, triggerBlink } = useShowAllEyeBlink();
  const resultCountChip = (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d max-lg:self-start lg:ms-auto"
      aria-live="polite"
    >
      {queueReady
        ? isPartyQueueToggleTable
          ? isPropertyAppraisalTable
            ? `${filteredCount} عقار`
            : `${filteredCount} صك`
          : (
              <>
                <span>النتائج:</span>
                {filteredCount}
              </>
            )
        : "—"}
    </span>
  );

  return (
    <PageToolbar
      className={cn(
        "shrink-0 flex-wrap items-center gap-2.5",
        /* Desktop: table-header strip. Mobile: HTML-like filter row on canvas. */
        "max-lg:mb-1 max-lg:flex-col max-lg:items-stretch max-lg:border-0 max-lg:bg-transparent max-lg:px-0 max-lg:pb-2 max-lg:pt-0",
        "lg:border-b lg:border-border lg:bg-surface-2",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
        <OperationalToolbarSearch
          type="search"
          placeholder={
            isPartyQueueToggleTable
              ? "رقم الصك أو المدينة أو الحي…"
              : isDistributionTable
                ? "رقم الصك أو PO أو المدينة…"
                : "رقم الصك أو نوع الإسناد أو المدينة…"
          }
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="بحث المعاملات"
        />
        <div className="flex flex-wrap items-center gap-2.5 max-lg:grid max-lg:w-full max-lg:grid-cols-2 lg:contents">
          {!isDistributionTable ? (
            <OperationalToolbarSelect
              className="shrink-0"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label={
                isAllTransactionsTable ? "تصفية المرحلة" : "تصفية الحالة"
              }
            >
              <option value="">جميع الحالات</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </OperationalToolbarSelect>
          ) : null}
          {isPartyQueueToggleTable ? (
            <button
              type="button"
              onClick={() => {
                if (!showCompleted) triggerBlink();
                onToggleShowCompleted();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors max-lg:justify-center",
                showCompleted ? TOGGLE_BUTTON_ON : TOGGLE_BUTTON_OFF,
              )}
              aria-pressed={showCompleted}
            >
              <ShowAllEye open={showCompleted} blink={showAllEyeBlink} />
              <span>
                {isPropertyAppraisalTable
                  ? showCompleted
                    ? "عرض قائمة العمل"
                    : "إظهار الكل"
                  : showCompleted
                    ? "إخفاء المكتملة"
                    : "إظهار المكتملة"}
              </span>
            </button>
          ) : (
            <OperationalToolbarSelect
              className="shrink-0"
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              aria-label="تصفية نوع الإسناد"
            >
              <option value="">جميع أنواع الإسناد</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </OperationalToolbarSelect>
          )}
        </div>
        {isAllTransactionsTable ? (
          <button
            type="button"
            onClick={onToggleGroupByPo}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors max-lg:w-full max-lg:justify-center",
              groupByPo ? TOGGLE_BUTTON_ON : TOGGLE_BUTTON_OFF,
            )}
            aria-pressed={groupByPo}
          >
            <GroupByPoIcon
              groupByPo={groupByPo}
              groupGatherAnim={groupGatherAnim}
            />
            <span>تجميع حسب أمر العمل</span>
          </button>
        ) : null}
        {resultCountChip}
      </div>
    </PageToolbar>
  );
}
