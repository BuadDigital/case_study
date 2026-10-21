"use client";

/**
 * Revenue stage tables — the cells, icons and row shells every stage table
 * shares. Pure decisions live in `lib/finance-revenue-state.ts`; the tables
 * themselves are one file each (`FinanceRevenue*Table.tsx`).
 */

import { fmtSar } from "@platform/app-shared/format/number";
import type { ReactNode } from "react";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  DeedLabel,
  EmptyState,
  MobileRecordCard,
  PoLabel,
  type MobileRecordField,
  THead,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  opsLetterCard,
} from "@platform/ui-kit";
import type { RevenueStage } from "../lib/finance-nav";
import {
  formatDateEn,
  revenueAmountsFromRow,
  revenueStageEmptyHint,
} from "../lib/finance-revenue-stages";
import { textOrDash } from "../lib/finance-revenue-state";
import {
  finGroupRow,
  finMuted,
  finNum,
  finSearchIcon,
  finTotRow,
} from "../lib/finance-tw";

export const EMPTY_TRACKING_ROWS: EnfazTrackingRowDto[] = [];

export function SearchIcon() {
  return (
    <svg
      className={finSearchIcon}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "shrink-0 text-text-3 transition-transform duration-150",
        open ? "rotate-0" : "-rotate-90",
      )}
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** Fee-line icons (keys + survey) beside the amount */
export function FeeFlags({ row }: { row: EnfazTrackingRowDto }) {
  const amt = revenueAmountsFromRow(row);
  const hasKey = amt.key > 0;
  const hasSurvey = (row.surveyFeeSar || 0) > 0;
  return (
    <span className="me-1 inline-flex gap-1.5" aria-hidden>
      <span
        title={hasKey ? "أتعاب استلام مفتاح" : "أتعاب استلام مفتاح — غير مفعّل"}
        className={cn(
          "inline-grid place-items-center",
          hasKey ? "text-[#b45309]" : "text-border-md",
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="7.5" cy="15.5" r="3.5" />
          <path d="M10 13 20 3" strokeLinecap="round" />
          <path d="M16.5 6.5 19 9" strokeLinecap="round" />
        </svg>
      </span>
      <span
        title={
          hasSurvey
            ? "بند رفع مساحي في فوترة إنفاذ"
            : "بند رفع مساحي (إنفاذ) — غير معبّأ"
        }
        className={cn(
          "inline-grid place-items-center",
          hasSurvey ? "text-[#1f3a5f]" : "text-border-md",
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 4v16h16" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 20 20 4" strokeLinecap="round" />
          <path d="M8 20v-3M12 20v-3M16 20v-3" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

export function DeedCell({ deed }: { deed: string }) {
  return <DeedLabel value={deed} />;
}

export function PoCell({ po }: { po: string }) {
  return <PoLabel value={po} />;
}

/** Centered city cell — `—` when the row has no city. */
export function CityCell({ row }: { row: EnfazTrackingRowDto }) {
  return (
    <Td className="text-center">
      <span className={finMuted}>{textOrDash(row.city)}</span>
    </Td>
  );
}

/** Centered LTR date cell (en-GB) — `—` without a date. */
export function CompletedAtCell({ iso }: { iso: string | null | undefined }) {
  return (
    <TdLtr className="text-center" valueClassName={finMuted}>
      {formatDateEn(iso)}
    </TdLtr>
  );
}

/** Fee flags + the row's total (table cell and phone card field). */
export function TotalFeesValue({ row }: { row: EnfazTrackingRowDto }) {
  const total = revenueAmountsFromRow(row).total;
  return (
    <span className="inline-flex items-center gap-2.5">
      <FeeFlags row={row} />
      <span className={finNum}>{fmtSar(total, { trim: "whole" })}</span>
    </span>
  );
}

/** Fee flags + the row's total, as the eligible / collected tables show it. */
export function TotalFeesCell({ row }: { row: EnfazTrackingRowDto }) {
  return (
    <Td className="text-center">
      <TotalFeesValue row={row} />
    </Td>
  );
}

/** City + completion date — the phone-card fields most stage tables share. */
export function revenueCityDateFields(row: EnfazTrackingRowDto): MobileRecordField[] {
  return [
    { label: "المدينة", value: textOrDash(row.city) },
    { label: "تاريخ الاكتمال", ltr: true, value: formatDateEn(row.completedAtUtc) },
  ];
}

/**
 * Phone counterpart of `GroupHeaderRow` — a full-width toggle above the
 * group's cards, with the group's actions (if any) as full-width buttons.
 */
export function MobileGroupHeader({
  open,
  onToggle,
  actions,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full cursor-pointer items-start gap-2.5 border-none bg-transparent px-3.5 py-3 text-start"
      >
        <span className="mt-0.5">
          <Chevron open={open} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
      </button>
      {actions ? (
        <div className="flex gap-2 px-3.5 pb-3 [&>*]:min-h-10 [&>*]:flex-1 [&>*]:justify-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Phone counterpart of a group-totals row — a muted summary card under the group's cards. */
export function MobileTotalsCard({
  title,
  fields,
}: {
  title: ReactNode;
  fields: MobileRecordField[];
}) {
  return (
    <MobileRecordCard
      tone="gold"
      className="bg-[color-mix(in_srgb,var(--gold)_7%,var(--surface))]"
      title={title}
      fields={fields}
    />
  );
}

export function RevenueTableHead({
  heads,
  firstStart = true,
}: {
  heads: string[];
  firstStart?: boolean;
}) {
  return (
    <THead>
      <Tr hoverable={false}>
        {heads.map((h, i) => (
          <Th
            key={`${h}-${i}`}
            className={
              h === ""
                ? "w-12"
                : !firstStart || i > 0
                  ? "text-center"
                  : undefined
            }
          >
            {h}
          </Th>
        ))}
      </Tr>
    </THead>
  );
}

/**
 * Collapsible group header row (work order / invoice). Click, Enter and Space
 * toggle; the whole row is one cell so the caller lays out its own content.
 */
export function GroupHeaderRow({
  colSpan,
  onToggle,
  children,
}: {
  colSpan: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Tr
      hoverable={false}
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <Td colSpan={colSpan} className={finGroupRow}>
        {children}
      </Td>
    </Tr>
  );
}

/** Empty cell on a group-totals row. */
export function TotalsBlankCell() {
  return <Td className={cn(finTotRow, "text-center")} />;
}

/** Label cell on a group-totals row («إجمالي أمر العمل», «إجمالي الفاتورة»). */
export function TotalsLabelCell({ children }: { children: ReactNode }) {
  return (
    <Td className={cn(finTotRow, "text-center")}>
      <span className="text-[11px] font-extrabold text-heading">{children}</span>
    </Td>
  );
}

/** Numeric LTR cell on a group-totals row. */
export function TotalsValueCell({
  valueClassName,
  children,
}: {
  valueClassName: string;
  children: ReactNode;
}) {
  return (
    <TdLtr className={cn(finTotRow, "text-center")} valueClassName={valueClassName}>
      {children}
    </TdLtr>
  );
}

export function RevenueStageEmpty({ stage }: { stage: RevenueStage }) {
  const hint = revenueStageEmptyHint(stage);
  return (
    <div className={opsLetterCard}>
      <EmptyState
        panel
        line={
          stage === "stopped"
            ? "لا معاملات متوقفة."
            : stage === "excluded"
              ? "لا مستبعدة حالياً."
              : "لا معاملات في هذه المرحلة."
        }
        hint={hint || undefined}
      />
    </div>
  );
}
