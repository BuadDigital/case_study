"use client";

/**
 * Filter strip above the active-transaction queue tables: search, the
 * status/type selects, the party-queue "show completed" eye and the result-count chip
 * («جميع العقارات» lost its group-by-PO toggle, Omar 2026-11-15). Presentation only — the screen owns
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

/** Same press / hover motion as the tab strips; the colours stay as they were. */
const TOGGLE_BUTTON_MOTION =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100";
const TOGGLE_BUTTON_ON = "border-ink bg-ink text-white";
const TOGGLE_BUTTON_OFF =
  "border-border-md bg-surface text-text-2 hover:bg-surface-2";

export function QueueFiltersToolbar({
  queueReady,
  isPartyQueueToggleTable,
  isPropertyAppraisalTable,
  isDistributionTable,
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
  onShowCompletedIntent,
  filteredCount,
}: {
  queueReady: boolean;
  isPartyQueueToggleTable: boolean;
  isPropertyAppraisalTable: boolean;
  isDistributionTable: boolean;
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
  /** Pointer / focus reached the toggle — warm the other slice before the click. */
  onShowCompletedIntent?: () => void;
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
              aria-label="تصفية الحالة"
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
              onPointerEnter={onShowCompletedIntent}
              onFocus={onShowCompletedIntent}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold max-lg:justify-center",
                TOGGLE_BUTTON_MOTION,
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
        {resultCountChip}
      </div>
    </PageToolbar>
  );
}
