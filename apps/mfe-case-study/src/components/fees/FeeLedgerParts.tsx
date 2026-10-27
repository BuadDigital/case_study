"use client";

/**
 * Ledger pieces shared by the parallel fee screens (`EngFeesLedgerSection`,
 * `PartyIndividualFeesHtmlScreen`) and the statement lists: the search +
 * status toolbar, the 7-column fee table, and the fee / statement phone-card
 * fields. Per-screen copy, date order, status rules and the action cell stay
 * with the caller.
 */

import type { ReactNode } from "react";
import { fmtSar } from "@platform/app-shared/format/number";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import {
  cn,
  StatusPill,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  type MobileRecordField,
  type StatusPillStyle,
} from "@platform/ui-kit";
import type {
  InspectorFeeRowDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { deedParts } from "./fee-screen-state";
import {
  opsFldControl,
  opsFilters,
  opsListCount,
  opsToolbar,
} from "../../lib/app-data/ops-tasks-tw";

type PillMeta = { label: string; style: StatusPillStyle };

const fmt3 = (n: number) => fmtSar(n, { digits: 3, trim: true });

/** Magnifier inside a fee search input (start side). */
export function FeeSearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute start-3 text-text-3"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** `.toolbar` > `.filters` — deed search, status dropdown (`children` = its options) and the count. */
export function FeeLedgerToolbar({
  search,
  setSearch,
  stFilter,
  setStFilter,
  count,
  children,
}: {
  search: string;
  setSearch: (v: string) => void;
  stFilter: string;
  setStFilter: (v: string) => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className={opsToolbar}>
      <div className={opsFilters}>
        <div className="relative flex items-center">
          <FeeSearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="رقم الصك أو المدينة أو الحي…"
            aria-label="بحث الأتعاب"
            className={cn(opsFldControl, "w-[248px] max-w-full ps-[38px]")}
          />
        </div>
        <div className="relative flex items-center">
          <select
            value={stFilter}
            onChange={(e) => setStFilter(e.target.value)}
            aria-label="تصفية الحالة"
            className={cn(opsFldControl, "cursor-pointer")}
          >
            <option value="">جميع الحالات</option>
            {children}
          </select>
        </div>
        <span className={opsListCount}>{count} بند</span>
      </div>
    </div>
  );
}

/**
 * «حسم مقترح − X · سبب» while the specialist's proposal waits for the supervisor, or null.
 * Shared by the fee ledgers and the workflow table so every screen words it the same way.
 * The server only fills `proposedDiscountSar` while the line is still waiting, so a non-null
 * value always means "undecided".
 */
export function proposedDiscountText(row: InspectorFeeRowDto): string | null {
  if (row.proposedDiscountSar == null) return null;
  return `حسم مقترح − ${fmt3(row.proposedDiscountSar)}${
    row.proposedDiscountReason ? ` · ${row.proposedDiscountReason}` : ""
  }`;
}

/** «− خصم · مبرر» text for a phone card, the pending proposal, or «بسعر الجدول». */
function discountText(row: InspectorFeeRowDto): string {
  const proposed = proposedDiscountText(row);
  if (proposed) return proposed;
  return row.supervisorDiscountSar > 0
    ? `− ${fmt3(row.supervisorDiscountSar)}${row.discountReason ? ` · ${row.discountReason}` : ""}`
    : "بسعر الجدول";
}

/** Phone-card fields of one fee row: date, net, table price, pricing change. */
export function feeRowCardFields(
  row: InspectorFeeRowDto,
  labels: { date: string; discount: string },
  date: string | null | undefined,
): MobileRecordField[] {
  return [
    { label: labels.date, ltr: true, value: formatYmd(date) },
    { label: "الصافي", ltr: true, value: fmt3(row.netFeeSar) },
    { label: "سعر الجدول", ltr: true, value: fmt3(row.agreedFeeSar) },
    { label: labels.discount, value: discountText(row) },
  ];
}

/** Desktop fee ledger (lg+): deed, date, table price, pricing change, net, status, action. */
export function FeeLedgerTable<S>({
  rows,
  pending,
  columns,
  rowKey,
  rowDate,
  rowStatus,
  renderAction,
  discountFullWidth = false,
  footer,
}: {
  rows: InspectorFeeRowDto[];
  pending: boolean;
  /** Header text of the date, pricing-change and action columns. */
  columns: { date: string; discount: string; action: string };
  rowKey: (row: InspectorFeeRowDto) => string;
  rowDate: (row: InspectorFeeRowDto) => string | null | undefined;
  rowStatus: (row: InspectorFeeRowDto) => { st: S; meta: PillMeta };
  renderAction: (row: InspectorFeeRowDto, st: S) => ReactNode;
  /** Let the pricing-change cell span the full column width. */
  discountFullWidth?: boolean;
  footer?: ReactNode;
}) {
  return (
    <TableFrame className="max-lg:hidden">
      <Table className="min-w-[920px]">
        <THead>
          <Tr hoverable={false}>
            <Th>الصك</Th>
            <Th>{columns.date}</Th>
            <Th>سعر الجدول</Th>
            <Th>{columns.discount}</Th>
            <Th>الصافي</Th>
            <Th>الحالة</Th>
            <Th>{columns.action}</Th>
          </Tr>
        </THead>
        <TBody>
          {pending && rows.length === 0 ? (
            <TableEmptyRow colSpan={7}>جاري التحميل…</TableEmptyRow>
          ) : rows.length === 0 ? (
            <TableEmptyRow colSpan={7}>لا توجد بنود مطابقة.</TableEmptyRow>
          ) : (
            rows.map((row) => {
              const { st, meta } = rowStatus(row);
              const { deed, region } = deedParts(row);
              const ded = row.supervisorDiscountSar > 0;
              const proposed = proposedDiscountText(row);
              return (
                <Tr key={rowKey(row)}>
                  <Td>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        dir="ltr"
                        className="inline-block text-start text-[13px] font-bold tabular-nums text-gold-d [unicode-bidi:isolate]"
                      >
                        {deed}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {region}
                      </span>
                    </div>
                  </Td>
                  <TdLtr valueClassName="text-[12px] text-text-2">
                    {formatYmd(rowDate(row))}
                  </TdLtr>
                  <TdLtr valueClassName="text-[12.5px] text-text-2">
                    {fmt3(row.agreedFeeSar)}
                  </TdLtr>
                  <Td>
                    {proposed ? (
                      <span className="text-[11px] font-semibold text-[#8a5e14]">
                        {proposed}
                      </span>
                    ) : ded ? (
                      <span
                        className={
                          discountFullWidth
                            ? "inline-flex min-w-0 max-w-full items-center gap-1.5"
                            : "inline-flex min-w-0 items-center gap-1.5"
                        }
                        title={row.discountReason ?? undefined}
                      >
                        <span
                          dir="ltr"
                          className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#a5432e] [unicode-bidi:isolate]"
                        >
                          − {fmt3(row.supervisorDiscountSar)}
                        </span>
                        <span className="truncate text-[10.5px] text-text-3">
                          {row.discountReason || ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-3">
                        بسعر الجدول
                      </span>
                    )}
                  </Td>
                  <TdLtr valueClassName="text-[13px] font-bold text-heading">
                    {fmt3(row.netFeeSar)}
                  </TdLtr>
                  <Td>
                    <StatusPill label={meta.label} style={meta.style} />
                  </Td>
                  <Td className="overflow-visible">{renderAction(row, st)}</Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
      {footer}
    </TableFrame>
  );
}

/** Phone-card fields of one statement: issue date, total, line count, payout. */
export function statementCardFields(
  s: PartyBillingStatementDto,
  payout: ReactNode,
  payoutWide = false,
): MobileRecordField[] {
  return [
    {
      label: "تاريخ الإصدار",
      ltr: true,
      value: formatYmd(s.issuedAtUtc ?? s.createdAtUtc),
    },
    { label: "الإجمالي", ltr: true, value: fmt3(s.totalNetSar) },
    { label: "المعاملات", value: `${s.lines.length} معاملات` },
    payoutWide
      ? { label: "الصرف", wide: true, value: payout }
      : { label: "الصرف", value: payout },
  ];
}

/** Statement table row cells: reference, issue date, line count, total, status, payout. */
export function StatementRowCells({
  s,
  meta,
  payout,
}: {
  s: PartyBillingStatementDto;
  meta: PillMeta;
  payout: ReactNode;
}) {
  return (
    <>
      <TdLtr valueClassName="font-bold text-gold-d text-[12.5px]">
        {s.referenceNumber}
      </TdLtr>
      <TdLtr valueClassName="text-[12px] text-text-2">
        {formatYmd(s.issuedAtUtc ?? s.createdAtUtc)}
      </TdLtr>
      <Td className="text-[12.5px]">
        {s.lines.length} معاملات
      </Td>
      <TdLtr valueClassName="text-[13px] font-bold text-heading">
        {fmt3(s.totalNetSar)}
      </TdLtr>
      <Td>
        <StatusPill label={meta.label} style={meta.style} />
      </Td>
      <Td className="text-[11px] text-text-2">{payout}</Td>
    </>
  );
}

/**
 * Phone fee-card list (below `lg`): three pulse placeholders while the first
 * page loads, «لا بنود.» when empty, otherwise the `<li>` cards.
 */
export function FeePhoneCards({
  pending,
  isEmpty,
  placeholderHeight,
  children,
}: {
  pending: boolean;
  isEmpty: boolean;
  /** Placeholder height class, e.g. `h-[100px]`. */
  placeholderHeight: string;
  children: ReactNode;
}) {
  if (pending && isEmpty) {
    return (
      <div className="space-y-2.5 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`${placeholderHeight} animate-pulse rounded-[12px] bg-surface-2`}
          />
        ))}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="m-0 px-3 py-8 text-center text-[13px] text-text-3">
        لا بنود.
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-3 max-lg:px-0">
      {children}
    </ul>
  );
}
