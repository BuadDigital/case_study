"use client";

/**
 * جداول طابور المعاملات النشطة بفروعها الخمسة + شريط الفلاتر — فُصلت عن
 * ActiveTransactionQueueView بعقود صريحة (SRP/ISP): كل جدول يستلم سياق الصف
 * المشترك QueueRowContext وخصائصه النوعية فقط، والشاشة تحتفظ بالحالة.
 */

import { Fragment, memo, type ReactNode } from "react";
import {
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  type StatusPillStyle,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import { RowAttentionDot } from "../components/ui/RowAttentionDot";
import { PartyAssigneeCell } from "../components/ui/PartyAssigneeCell";
import { HoverPortalCard } from "../components/ui/HoverPortalCard";
import {
  buildDistributionTableRow,
  findPropertyForTask,
  type RemainingTimeState,
} from "../lib/prototype/my-task-row";
import type { PrimaryQueueRowMeta } from "../lib/prototype/active-queue-list-filters";
import { INSPECTION_TABLE_TYPE } from "../lib/prototype/queue-table-type";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import {
  allTransactionsPhaseStyle,
  buildAllTransactionsQueueRowMeta,
} from "../lib/prototype/all-transactions-queue";
import { buildCaseStudyPartyAssignees } from "../lib/prototype/case-study-tracks";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserQueueStatusBadge,
  appraiserSurveyDone,
} from "@evaluator/mfe/lib/evaluator/evaluator-queue";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;
const allTransactionsSkeletonCols = 7;
const primarySkeletonCols = 7;
/** مرجع ثابت لغياب تقدّم الأطراف — `{}` جديد يقتل تذكير الصف. */
const EMPTY_PARTY_PROGRESS: Partial<Record<CaseStudyInfoPartyId, number>> = {};

/* أيقونتان ثابتتان في بطاقة الأطراف — كانتا تُبنيان لكل طرف في كل صف وكل
   تصيير رغم أنهما بلا مدخلات (rendering-hoist-jsx). */
const PARTY_DEP_DONE_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2f7a4d"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m5 13 4 4L19 7" />
  </svg>
);
const PARTY_DEP_PENDING_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9aa0ab"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** سياق الصف المشترك بين كل فروع الجدول — يُبنى مرة واحدة في الشاشة. */
export type QueueRowContext = {
  queuePending: boolean;
  /** التحميل الأول بلا مهام بعد — صفوف skeleton. */
  showSkeleton: boolean;
  selectedId: string | null;
  isTaskOpening: (taskId: string) => boolean;
  handleRowClick: (taskId: string) => void;
  resolveRowAttention: (task: WorkflowTask) => boolean;
  resolveRowMoreItems: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => RowMoreMenuItem[];
};

export type QueueStatusBadge = { label: string; className: string } | null;

export type PartyProgressByTask = Map<
  string,
  Partial<Record<CaseStudyInfoPartyId, number>>
>;

type AllTxRowMeta = ReturnType<typeof buildAllTransactionsQueueRowMeta>[number];

/** Case Study.html `ENG_ST` / `VAL` status pill colors. */
export function engSurveyStatusPillStyle(className: string): StatusPillStyle {
  if (className.includes("done")) {
    return { base: "#3f8f5f", fg: "#2f7a4d" };
  }
  if (className.includes("fail") || className.includes("returned")) {
    return { base: "#d9694f", fg: "#a5432e" };
  }
  if (className.includes("prog")) {
    return { base: "#d9a441", fg: "#8a5e14" };
  }
  if (className.includes("gold")) {
    return { base: "#a4906f", fg: "#8c7857" };
  }
  if (className.includes("navy")) {
    return { base: "#102B4E", fg: "#102B4E" };
  }
  // جديد — GRAY in prototype (not blue)
  return { base: "#6b7c8f", fg: "#4a5568" };
}

/** Case Study.html remaining column: يومان / N أيام / متأخر. */
export function formatEngSurveyRemaining(state: RemainingTimeState): {
  text: string;
  overdue: boolean;
} {
  if (state.status === "missing") return { text: "—", overdue: false };
  if (state.status === "overdue") return { text: "متأخر", overdue: true };
  const days = state.days;
  if (days <= 0) return { text: "0 أيام", overdue: false };
  if (days === 1) return { text: "يوم", overdue: false };
  if (days === 2) return { text: "يومان", overdue: false };
  return { text: `${days} أيام`, overdue: false };
}

/** تاريخ الإسناد YYYY/MM/DD — كان مكرراً حرفياً في فرعي الرفع والتقييم. */
function assignedDateLabel(
  task: WorkflowTask,
  record: PoIntakeRecord | undefined,
): string {
  const raw = task.createdAt || record?.receivedFromEnfathAt || "";
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/* ─── شريط الفلاتر ─── */

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
              onClick={onToggleShowCompleted}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors max-lg:justify-center",
                showCompleted
                  ? "border-ink bg-ink text-white"
                  : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
              )}
              aria-pressed={showCompleted}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
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
              groupByPo
                ? "border-ink bg-ink text-white"
                : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
            )}
            aria-pressed={groupByPo}
          >
            <span
              className="relative inline-grid size-[15px] shrink-0 place-items-center"
              aria-hidden
            >
              {/* الحركة على غلاف الأيقونة — الـsvg نفسه ثابت فلا يعاد رسم
                  مساراته مع كل إطار انتقال (rendering-animate-svg-wrapper). */}
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
            <span>تجميع حسب أمر العمل</span>
          </button>
        ) : null}
        {resultCountChip}
      </div>
    </PageToolbar>
  );
}

/* ─── جميع المعاملات ─── */

/* الصفوف مذكّرة: ctx يُبنى بـuseMemo في الشاشة وmeta يأتي من مصفوفة مذكّرة،
   فلا يعاد تصيير الصف مع كل ضغطة بحث أو نبضة دقيقة (rerender-memo). */
const AllTransactionsRow = memo(function AllTransactionsRow({
  ctx,
  meta,
}: {
  ctx: QueueRowContext;
  meta: AllTxRowMeta;
}) {
  const active = ctx.selectedId === meta.task.id;
  const moreItems = ctx.resolveRowMoreItems(meta.task, meta.propertyId);
  return (
    <Tr
      hoverable={false}
      className={cn(
        "group/atq-row",
        ROW,
        active && ROW_ACTIVE,
        ctx.isTaskOpening(meta.task.id) &&
          "ui-queue-row-opening pointer-events-none",
      )}
      onClick={() => ctx.handleRowClick(meta.task.id)}
    >
      <Td className="whitespace-nowrap">
        <InteractiveDeedCell
          label={meta.deedCell}
          loading={ctx.isTaskOpening(meta.task.id)}
          trailing={
            ctx.resolveRowAttention(meta.task) ? <RowAttentionDot /> : undefined
          }
        />
      </Td>
      <Td>
        <PoNumber
          value={meta.poNumber}
          link
          className="!text-[12.5px] !font-semibold text-text-2"
        />
      </Td>
      <Td className="text-text-2">{meta.assignmentType}</Td>
      <Td className="text-text-2">{meta.city}</Td>
      <Td className="text-text-2">{meta.district}</Td>
      <Td>
        <StatusPill
          label={meta.phaseLabel}
          style={allTransactionsPhaseStyle(meta.task)}
        />
      </Td>
      <TdAction>
        <RowMoreMenu items={moreItems} />
      </TdAction>
    </Tr>
  );
});

export function AllTransactionsQueueTable({
  ctx,
  filteredMeta,
  groupByPo,
  poGroups,
  collapsedPo,
  onToggleCollapsed,
  onOpenPoProperties,
}: {
  ctx: QueueRowContext;
  filteredMeta: AllTxRowMeta[];
  groupByPo: boolean;
  poGroups: { po: string; rows: AllTxRowMeta[] }[];
  collapsedPo: Record<string, boolean>;
  onToggleCollapsed: (po: string) => void;
  onOpenPoProperties: (po: string) => void;
}) {
  return (
    <Table className="w-full lg:min-w-[720px]" pending={ctx.queuePending}>
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>نوع الإسناد</Th>
          <Th>المدينة</Th>
          <Th>الحي</Th>
          <Th>المرحلة</Th>
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={allTransactionsSkeletonCols} />
        ) : filteredMeta.length === 0 ? (
          <Tr hoverable={false}>
            <Td
              colSpan={allTransactionsSkeletonCols}
              className="!py-11 text-center text-[13.5px] text-text-3"
            >
              لا توجد معاملات مطابقة.
            </Td>
          </Tr>
        ) : groupByPo ? (
          poGroups.map(({ po, rows }, groupIndex) => {
            const open = !collapsedPo[po];
            return (
              <Fragment key={po}>
                <Tr
                  hoverable={false}
                  className="cursor-pointer bg-surface-2 animate-[atq-group-row-in_0.28s_ease-out_both] motion-reduce:animate-none"
                  style={{
                    animationDelay: `${Math.min(groupIndex, 8) * 35}ms`,
                  }}
                  onClick={() => onOpenPoProperties(po)}
                >
                  <Td colSpan={allTransactionsSkeletonCols}>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        className="grid place-items-center rounded-md p-0.5 text-text-3 hover:bg-surface"
                        title={open ? "طي" : "فتح"}
                        aria-label={open ? "طي المجموعة" : "فتح المجموعة"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCollapsed(po);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={cn(
                            "transition-transform duration-150",
                            !open && "-rotate-90",
                          )}
                          aria-hidden
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      <span
                        dir="ltr"
                        className="text-[13px] font-extrabold text-heading"
                      >
                        {po}
                      </span>
                      <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[11.5px] font-bold text-gold-d">
                        {rows.length} معاملة
                      </span>
                      <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-bold text-gold-d">
                        دخول أمر العمل
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </Td>
                </Tr>
                {open
                  ? rows.map((meta) => (
                      <AllTransactionsRow
                        key={meta.task.id}
                        ctx={ctx}
                        meta={meta}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })
        ) : (
          filteredMeta.map((meta) => (
            <AllTransactionsRow key={meta.task.id} ctx={ctx} meta={meta} />
          ))
        )}
      </TBody>
    </Table>
  );
}

/* ─── التوزيع / دراسة الحالة ─── */

const DistributionQueueRow = memo(function DistributionQueueRow({
  ctx,
  task,
  index,
  record,
  showPartyColumns,
  disableRowOpen,
  tasks,
  partyProgressByTask,
  staffUsers,
  onRowClick,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  task: WorkflowTask;
  index: number;
  record: PoIntakeRecord | undefined;
  showPartyColumns: boolean;
  disableRowOpen: boolean;
  tasks: WorkflowTask[];
  partyProgressByTask: PartyProgressByTask;
  staffUsers: Parameters<typeof buildCaseStudyPartyAssignees>[3];
  onRowClick: (task: WorkflowTask, propertyId: string | undefined) => void;
  openPropertyDetail: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => void;
}) {
  const property = findPropertyForTask(record, task);
  const row = buildDistributionTableRow(task, property, record);
  const parties = showPartyColumns
    ? buildCaseStudyPartyAssignees(
        task,
        tasks,
        partyProgressByTask.get(task.id) ?? EMPTY_PARTY_PROGRESS,
        staffUsers,
      )
    : [];
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  return (
    <Tr
      hoverable={false}
      className={cn(
        "group/atq-row",
        ROW,
        active && ROW_ACTIVE,
        ctx.isTaskOpening(task.id) &&
          "ui-queue-row-opening pointer-events-none",
      )}
      onClick={
        disableRowOpen ? undefined : () => onRowClick(task, property?.id)
      }
    >
      <Td className="whitespace-nowrap">
        <span className="inline-flex min-w-0 items-center justify-end gap-2">
          <span
            className={cn(
              "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-surface-3 tabular-nums",
              INSPECTION_TABLE_TYPE.ordinal,
            )}
            aria-hidden
          >
            {index + 1}
          </span>
          {property?.id ? (
            <button
              type="button"
              className="relative z-[1] inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0 font-inherit text-start"
              onClick={(e) => {
                e.stopPropagation();
                openPropertyDetail(task, property.id);
              }}
            >
              <InteractiveDeedCell
                label={row.deedLabel}
                loading={ctx.isTaskOpening(task.id)}
                labelClassName={INSPECTION_TABLE_TYPE.deed}
                trailing={
                  ctx.resolveRowAttention(task) ? (
                    <RowAttentionDot />
                  ) : undefined
                }
              />
            </button>
          ) : (
            <InteractiveDeedCell
              label={row.deedLabel}
              loading={ctx.isTaskOpening(task.id)}
              labelClassName={INSPECTION_TABLE_TYPE.deed}
              trailing={
                ctx.resolveRowAttention(task) ? <RowAttentionDot /> : undefined
              }
            />
          )}
        </span>
      </Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>
        <PoNumber
          value={task.poNumber}
          link
          className={INSPECTION_TABLE_TYPE.po}
        />
      </Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.city}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.district}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.propertyType}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.classification}</Td>
      <Td className={INSPECTION_TABLE_TYPE.body}>{row.area}</Td>
      {showPartyColumns
        ? parties.map((party) => (
            <Td
              key={party.trackId}
              className={cn(
                "w-[7.5rem] min-w-[7.5rem] overflow-hidden",
                INSPECTION_TABLE_TYPE.body,
              )}
            >
              <PartyAssigneeCell party={party} />
            </Td>
          ))
        : null}
      <TdAction>
        <RowMoreMenu items={moreItems} />
      </TdAction>
    </Tr>
  );
});

export function DistributionQueueTable({
  ctx,
  showPartyColumns,
  disableRowOpen,
  filteredListed,
  poByNumber,
  tasks,
  partyProgressByTask,
  staffUsers,
  onRowClick,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  showPartyColumns: boolean;
  disableRowOpen: boolean;
  filteredListed: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  tasks: WorkflowTask[];
  partyProgressByTask: PartyProgressByTask;
  staffUsers: Parameters<typeof buildCaseStudyPartyAssignees>[3];
  onRowClick: (task: WorkflowTask, propertyId: string | undefined) => void;
  openPropertyDetail: (task: WorkflowTask, propertyId: string | undefined) => void;
}) {
  const distributionSkeletonCols = 8 + (showPartyColumns ? 3 : 0);
  return (
    <Table
      className={cn(
        "w-full",
        showPartyColumns ? "min-w-0" : "lg:min-w-[720px]",
      )}
      pending={ctx.queuePending}
    >
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>المدينة</Th>
          <Th>الحي</Th>
          <Th>نوع العقار</Th>
          <Th>التصنيف</Th>
          <Th>المساحة</Th>
          {showPartyColumns ? (
            <>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المكتب الهندسي</Th>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المعاين</Th>
              <Th className="w-[7.5rem] min-w-[7.5rem]">المقيم</Th>
            </>
          ) : null}
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={distributionSkeletonCols} />
        ) : (
          filteredListed.map((task, index) => (
            <DistributionQueueRow
              key={task.id}
              ctx={ctx}
              task={task}
              index={index}
              record={poByNumber.get(task.poNumber.trim())}
              showPartyColumns={showPartyColumns}
              disableRowOpen={disableRowOpen}
              tasks={tasks}
              partyProgressByTask={partyProgressByTask}
              staffUsers={staffUsers}
              onRowClick={onRowClick}
              openPropertyDetail={openPropertyDetail}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}

/* ─── الرفع المساحي ─── */

const EngineeringSurveyRow = memo(function EngineeringSurveyRow({
  ctx,
  meta,
  resolveTaskBadge,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  resolveTaskBadge: (task: WorkflowTask) => QueueStatusBadge;
}) {
  const { task, record, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const contact =
    property?.contacts?.find(
      (c) => c.name.trim() || c.phone.trim() || c.role.trim(),
    ) ?? null;
  const contactName = contact?.name.trim() || "—";
  const contactPhone = contact?.phone.trim() || "";
  const contactRole = contact?.role.trim() || "";
  const missingPhone = !contactPhone;
  const cityDistrict = [row.city, row.district]
    .filter((v) => v && v !== "—")
    .join(" — ");
  const assignedLabel = assignedDateLabel(task, record);
  const badge = resolveTaskBadge(task);
  const statusLabel = badge?.label ?? "—";
  const statusClass = badge?.className ?? "b-new";
  const propertyType =
    property?.propertyType?.trim() ||
    property?.classification?.trim() ||
    "";
  const remaining = formatEngSurveyRemaining(row.remainingTime);
  return (
    <Tr
      hoverable={false}
      className={cn(
        "group/atq-row",
        ROW,
        active && ROW_ACTIVE,
        missingPhone && "opacity-55",
        ctx.isTaskOpening(task.id) &&
          "ui-queue-row-opening pointer-events-none",
      )}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        <InteractiveDeedCell
          label={row.propertySlot}
          loading={ctx.isTaskOpening(task.id)}
          tone="gold"
          labelClassName="text-[13.5px] justify-end"
          trailing={
            ctx.resolveRowAttention(task) ? (
              <RowAttentionDot />
            ) : undefined
          }
          subtitle={
            propertyType ? (
              <span className="text-[11.5px] font-normal text-text-3 no-underline">
                {propertyType}
              </span>
            ) : null
          }
        />
      </Td>
      <Td className="text-[13px] text-text-2">
        {cityDistrict || "—"}
      </Td>
      <Td className="overflow-visible">
        {contactName !== "—" ? (
          <HoverPortalCard
            align="start"
            triggerClassName="inline-flex"
            panelClassName="flex min-w-[220px] flex-col gap-1.5 rounded-[11px] border border-border-md bg-surface p-3 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
            content={
              <>
                <span className="text-[12.5px] font-bold text-heading">
                  {contactName}
                </span>
                {contactRole ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
                    {contactRole}
                  </span>
                ) : null}
                <span
                  dir="ltr"
                  className="inline-flex items-center justify-end gap-1.5 text-[12px] text-text-2"
                >
                  {contactPhone ? (
                    contactPhone
                  ) : (
                    <span className="font-bold text-[#a5432e]">
                      لا يوجد رقم اتصال
                    </span>
                  )}
                </span>
              </>
            }
          >
            <span className="border-b border-dashed border-border-md pb-px text-[13px] font-semibold text-heading">
              {contactName}
            </span>
          </HoverPortalCard>
        ) : (
          <span className="text-[13px] font-semibold text-heading">
            —
          </span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-[12.5px] text-text-2">
        {/* Keep YYYY/MM/DD order without flipping cell start edge in RTL */}
        <span dir="ltr" className="inline-block tabular-nums">
          {assignedLabel}
        </span>
      </Td>
      <Td>
        <div className="flex flex-col items-start gap-1">
          <StatusPill
            label={statusLabel}
            style={engSurveyStatusPillStyle(statusClass)}
          />
          {missingPhone ? (
            <span className="whitespace-nowrap rounded-md border border-[color-mix(in_srgb,#d9694f_28%,transparent)] bg-[color-mix(in_srgb,#d9694f_10%,transparent)] px-[7px] py-0.5 text-[10.5px] font-bold text-[#a5432e]">
              بلا رقم اتصال
            </span>
          ) : null}
        </div>
      </Td>
      <Td
        className={cn(
          "text-[13px] font-semibold",
          remaining.overdue ? "text-[#d9694f]" : "text-heading",
        )}
      >
        {missingPhone ? (
          <span className="inline-flex flex-col gap-px">
            <span className="text-text-3">معلّق</span>
            <span className="text-[10.5px] font-medium text-text-3">
              لا يُحتسب الوقت
            </span>
          </span>
        ) : statusClass === "b-fail" ||
          statusClass === "b-returned" ? (
          <span className="inline-flex flex-col gap-px">
            <span className="text-text-3">متوقف</span>
            <span className="text-[10.5px] font-medium text-text-3">
              بانتظار معالجة التعذر
            </span>
          </span>
        ) : (
          remaining.text
        )}
      </Td>
      <TdAction>
        <RowMoreMenu items={moreItems} />
      </TdAction>
    </Tr>
  );
});

export function EngineeringSurveyQueueTable({
  ctx,
  filteredMeta,
  resolveTaskBadge,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  resolveTaskBadge: (task: WorkflowTask) => QueueStatusBadge;
  statusColumnLabel: string | undefined;
}) {
  return (
    <Table
      className="w-full"
      pending={ctx.queuePending}
      wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
    >
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>المدينة / الحي</Th>
          <Th>ضابط الاتصال</Th>
          <Th>تاريخ الإسناد</Th>
          <Th>{statusColumnLabel ?? "الحالة"}</Th>
          <Th>المتبقي</Th>
          <Th className="w-16 text-center">إجراءات</Th>
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={7} />
        ) : filteredMeta.length === 0 ? (
          <Tr hoverable={false}>
            <Td
              colSpan={7}
              className="!py-11 text-center text-[13.5px] text-text-3"
            >
              لا توجد أوامر رفع مطابقة.
            </Td>
          </Tr>
        ) : (
          // الصف مبني مسبقاً في الـmeta — لا إعادة بناء لكل تصيير (js-combine-iterations).
          filteredMeta.map((meta) => (
            <EngineeringSurveyRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              resolveTaskBadge={resolveTaskBadge}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}

/* ─── التقييم العقاري ─── */

const PropertyAppraisalRow = memo(function PropertyAppraisalRow({
  ctx,
  meta,
  tasks,
  openPropertyDetail,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  tasks: WorkflowTask[];
  openPropertyDetail: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => void;
}) {
  const { task, record, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const cityDistrict = [row.city, row.district]
    .filter((v) => v && v !== "—")
    .join(" — ");
  const assignedLabel = assignedDateLabel(task, record);
  const badge = appraiserQueueStatusBadge(task, tasks);
  const inspected = appraiserInspectionDone(task, tasks);
  const needsSurvey = appraiserNeedsSurvey(task, tasks);
  const surveyed = appraiserSurveyDone(task, tasks);
  const propertyType =
    property?.propertyType?.trim() ||
    property?.classification?.trim() ||
    "";
  const deps: {
    name: string;
    role: string;
    ok: boolean;
    letter: string;
    ink: boolean;
  }[] = [
    {
      name: "المعاين",
      role: "المعاينة الميدانية",
      ok: inspected,
      letter: "م",
      ink: true,
    },
  ];
  if (needsSurvey) {
    deps.push({
      name: "المكتب الهندسي",
      role: "الرفع المساحي",
      ok: surveyed,
      letter: "هـ",
      ink: false,
    });
  }
  const deedCell = (
    <InteractiveDeedCell
      label={row.propertySlot}
      loading={ctx.isTaskOpening(task.id)}
      tone="gold"
      labelClassName="text-[13.5px] justify-end"
      trailing={
        ctx.resolveRowAttention(task) ? <RowAttentionDot /> : undefined
      }
      subtitle={
        propertyType ? (
          <span className="text-[11.5px] font-normal text-text-3 no-underline">
            {propertyType}
          </span>
        ) : null
      }
    />
  );
  return (
    <Tr
      hoverable={false}
      className={cn(
        "group/atq-row",
        ROW,
        active && ROW_ACTIVE,
        !inspected && "opacity-55",
        ctx.isTaskOpening(task.id) &&
          "ui-queue-row-opening pointer-events-none",
      )}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        {property?.id ? (
          <button
            type="button"
            className="relative z-[1] inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0 font-inherit text-start"
            aria-label={`تفاصيل العقار ${row.propertySlot}`}
            onClick={(e) => {
              e.stopPropagation();
              openPropertyDetail(task, property.id);
            }}
          >
            {deedCell}
          </button>
        ) : (
          deedCell
        )}
      </Td>
      <Td className="text-center text-[13px] text-text-2">
        {cityDistrict || "—"}
      </Td>
      <Td dir="ltr" className="text-center text-[12px] text-text-2">
        <PoNumber value={task.poNumber} link />
      </Td>
      <Td className="whitespace-nowrap text-center text-[12.5px] text-text-2">
        <span dir="ltr" className="inline-block tabular-nums">
          {assignedLabel}
        </span>
      </Td>
      <Td className="overflow-visible text-center">
        <HoverPortalCard
          align="start"
          triggerClassName="inline-flex"
          panelClassName="flex min-w-[240px] flex-col gap-1 rounded-[11px] border border-border-md bg-surface p-2.5 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
          content={
            <>
              <span className="mb-1 px-1 text-[11px] font-bold text-text-3">
                أطراف المعاملة ({deps.length})
              </span>
              {deps.map((dep) => (
                <div
                  key={dep.role}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1 py-1",
                    !dep.ok && "opacity-50",
                  )}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{
                      background: dep.ink
                        ? "var(--ink, #102B4E)"
                        : "var(--gold-d, #8c7857)",
                    }}
                  >
                    {dep.letter}
                  </span>
                  <span className="inline-flex min-w-0 flex-col">
                    <span className="text-[12.5px] font-semibold text-heading">
                      {dep.name}
                    </span>
                    <span className="whitespace-nowrap text-[10.5px] text-text-3">
                      {dep.role}
                    </span>
                  </span>
                  <span className="ms-auto">
                    {dep.ok
                      ? PARTY_DEP_DONE_ICON
                      : PARTY_DEP_PENDING_ICON}
                  </span>
                </div>
              ))}
            </>
          }
        >
          <span className="team inline-flex items-center">
            {deps.map((dep, i) => (
              <span
                key={dep.role}
                className="grid size-7 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white"
                style={{
                  background: dep.ink
                    ? "var(--ink, #102B4E)"
                    : "var(--gold-d, #8c7857)",
                  marginInlineStart: i === 0 ? 0 : -8,
                  opacity: dep.ok ? 1 : 0.35,
                }}
              >
                {dep.letter}
              </span>
            ))}
          </span>
        </HoverPortalCard>
      </Td>
      <Td className="text-center">
        <StatusPill
          label={badge.label}
          style={engSurveyStatusPillStyle(badge.className)}
        />
      </Td>
      <TdAction>
        <RowMoreMenu items={moreItems} />
      </TdAction>
    </Tr>
  );
});

export function PropertyAppraisalQueueTable({
  ctx,
  filteredMeta,
  tasks,
  openPropertyDetail,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  tasks: WorkflowTask[];
  openPropertyDetail: (task: WorkflowTask, propertyId: string | undefined) => void;
  statusColumnLabel: string | undefined;
}) {
  return (
    <Table
      className="w-full"
      pending={ctx.queuePending}
      wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
    >
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th className="text-center">المدينة / الحي</Th>
          <Th className="text-center">أمر العمل</Th>
          <Th className="text-center">تاريخ الإسناد</Th>
          <Th className="text-center">الأطراف</Th>
          <Th className="text-center">{statusColumnLabel ?? "الحالة"}</Th>
          <Th className="w-16 text-center">إجراءات</Th>
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={7} />
        ) : filteredMeta.length === 0 ? (
          <Tr hoverable={false}>
            <Td
              colSpan={7}
              className="!py-11 text-center text-[13.5px] text-text-3"
            >
              لا توجد مهام تقييم مطابقة.
            </Td>
          </Tr>
        ) : (
          // الصف مبني مسبقاً في الـmeta — لا إعادة بناء لكل تصيير.
          filteredMeta.map((meta) => (
            <PropertyAppraisalRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              tasks={tasks}
              openPropertyDetail={openPropertyDetail}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}

/* ─── البيانات الأساسية (الافتراضي) ─── */

const PrimaryQueueRow = memo(function PrimaryQueueRow({
  ctx,
  meta,
  primaryHasLocation,
  renderStatusOrRemaining,
}: {
  ctx: QueueRowContext;
  meta: PrimaryQueueRowMeta;
  primaryHasLocation: boolean;
  renderStatusOrRemaining: (
    task: WorkflowTask,
    remainingTime: RemainingTimeState,
  ) => ReactNode;
}) {
  const { task, property, row } = meta;
  const active = ctx.selectedId === task.id;
  const moreItems = ctx.resolveRowMoreItems(task, property?.id);
  const isStudyLabel = row.propertySlot.startsWith("قيد الدراسة");
  return (
    <Tr
      hoverable={false}
      className={cn(
        "group/atq-row",
        ROW,
        active && ROW_ACTIVE,
        ctx.isTaskOpening(task.id) &&
          "ui-queue-row-opening pointer-events-none",
      )}
      onClick={() => ctx.handleRowClick(task.id)}
    >
      <Td className="whitespace-nowrap">
        <InteractiveDeedCell
          label={row.propertySlot}
          loading={ctx.isTaskOpening(task.id)}
          tone={isStudyLabel ? "gold" : "primary"}
          rtl={isStudyLabel}
        />
      </Td>
      <Td className="text-text-2">
        <PoNumber
          value={task.poNumber}
          link
          className="!text-[12.5px] !font-semibold text-text-2"
        />
      </Td>
      <Td className="text-text-2">{row.assignmentType}</Td>
      {primaryHasLocation ? (
        <>
          <Td className="text-text-2">{row.city}</Td>
          <Td className="text-text-2">{row.district}</Td>
        </>
      ) : null}
      <Td className="text-text-2">
        {renderStatusOrRemaining(task, row.remainingTime)}
      </Td>
      <TdAction>
        <RowMoreMenu items={moreItems} />
      </TdAction>
    </Tr>
  );
});

export function PrimaryQueueTable({
  ctx,
  filteredMeta,
  primaryHasLocation,
  renderStatusOrRemaining,
  statusColumnLabel,
}: {
  ctx: QueueRowContext;
  filteredMeta: PrimaryQueueRowMeta[];
  primaryHasLocation: boolean;
  renderStatusOrRemaining: (
    task: WorkflowTask,
    remainingTime: RemainingTimeState,
  ) => ReactNode;
  statusColumnLabel: string | undefined;
}) {
  return (
    <Table className="w-full" pending={ctx.queuePending}>
      <THead>
        <Tr hoverable={false}>
          <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
          <Th>أمر العمل</Th>
          <Th>نوع الإسناد</Th>
          {primaryHasLocation ? (
            <>
              <Th>المدينة</Th>
              <Th>الحي</Th>
            </>
          ) : null}
          <Th>{statusColumnLabel ?? "الحالة"}</Th>
          <ThAction aria-label="المزيد" />
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows
            rows={6}
            cols={
              primaryHasLocation ? primarySkeletonCols : primarySkeletonCols - 2
            }
          />
        ) : (
          // الصف مبني مسبقاً في الـmeta — لا إعادة بناء لكل تصيير.
          filteredMeta.map((meta) => (
            <PrimaryQueueRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
              primaryHasLocation={primaryHasLocation}
              renderStatusOrRemaining={renderStatusOrRemaining}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}
