"use client";

/** Revenue screen tables by stage — module-level components, moved literally from the screen (SRP). */

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmt } from "@platform/app-shared/format/number";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadEnfazTracking } from "@platform/app-shared/app-data/enfaz-billing-api";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  DeedLabel,
  EmptyState,
  PoLabel,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  finStatusStyle,
  opsBtnGhost,
  opsBtnPrimary,
  opsCheckInput,
  opsLetterCard,
  type StatusPillStyle,
} from "@platform/ui-kit";
import { REVENUE_STAGES, type RevenueStage } from "../lib/finance-nav";
import {
  formatDateEn,
  groupRowsByInvoice,
  groupRowsByPo,
  revenueAmountsFromRow,
  revenueInPeriod,
  revenuePeriodDateIso,
  revenueStageEmptyHint,
  rowAgeDays,
  stoppedReasonLabel,
  uniqueCities,
  bucketRevenueRows,
} from "../lib/finance-revenue-stages";
import {
  finGroupRow,
  finMuted,
  finNum,
  finSearchIcon,
  finTotRow,
} from "../lib/finance-tw";
import { FinanceStagePills } from "./FinanceStagePills";
import { FinanceEnfazPoBilling } from "./FinanceEnfazPoBilling";
import { FinanceEnfazFollowupsPanel } from "./FinanceEnfazFollowupsPanel";

export const EMPTY_TRACKING_ROWS: EnfazTrackingRowDto[] = [];

// Whole amounts without decimals; fractional with two — differs from shared fmtSar which always fixes decimals.
export function fmtSar(n: number) {
  return `${fmt(n, n % 1 === 0 ? 0 : 2)} ر.س`;
}

export function filterRows(
  rows: EnfazTrackingRowDto[],
  q: string,
  city: string,
  period: "all" | "30" | "90",
): EnfazTrackingRowDto[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (city && city !== "all") {
      if ((r.city ?? "").trim() !== city) return false;
    }
    if (!revenueInPeriod(revenuePeriodDateIso(r), period)) return false;
    if (!needle) return true;
    const hay =
      `${r.poNumber} ${r.deedNumber} ${r.propertyLabel} ${r.invoiceNumber ?? ""} ${r.city}`.toLowerCase();
    return hay.includes(needle);
  });
}

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

const GROUP_TD = finGroupRow;
const TOT_TD = finTotRow;

function RevenueTableHead({
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

/* ─── stage tables ─── */

export function StudyTable({
  rows,
  allRows,
  collapsed,
  onToggleGroup,
}: {
  rows: EnfazTrackingRowDto[];
  /** All tracking rows — for «X of Y» inside a work order */
  allRows: EnfazTrackingRowDto[];
  collapsed: Record<string, boolean>;
  onToggleGroup: (po: string) => void;
}) {
  const colSpan = 4;
  const poTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) {
      const k = r.poNumber || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [allRows]);

  const groups = useMemo(() => {
    const g = groupRowsByPo(rows);
    return g
      .map((x) => ({
        ...x,
        rows: [...x.rows].sort((a, b) =>
          (b.completedAtUtc || "").localeCompare(a.completedAtUtc || ""),
        ),
      }))
      .sort((a, b) => a.poNumber.localeCompare(b.poNumber, "en"));
  }, [rows]);

  return (
    <TableFrame>
      <Table className="min-w-[780px]">
        <RevenueTableHead
          heads={[
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
          ]}
        />
        <TBody>
          {groups.map(({ poNumber, rows: group }) => {
            const open = collapsed[poNumber] === true;
            const totalInPo = poTotals.get(poNumber) ?? group.length;
            const studyInPo = group.length;
            let feesSum = 0;
            let feesKnown = false;
            for (const r of group) {
              const t = revenueAmountsFromRow(r).total;
              if (t > 0) {
                feesSum += t;
                feesKnown = true;
              }
            }

            return (
              <Fragment key={poNumber}>
                <Tr
                  hoverable={false}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onToggleGroup(poNumber)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleGroup(poNumber);
                    }
                  }}
                >
                  <Td colSpan={colSpan} className={GROUP_TD}>
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-[9px]">
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-[9px]">
                        <Chevron open={open} />
                        <span className="text-[12.5px] font-extrabold text-heading">
                          أمر العمل{" "}
                          <span className="text-gold-d" dir="ltr">
                            {poNumber}
                          </span>
                        </span>
                        <span className="text-[11px] leading-snug text-text-3">
                          تحت الدراسة {studyInPo} من {totalInPo} معاملة في الطلب
                          {" — "}
                          أتعاب{" "}
                          <b className="font-bold text-heading" dir="ltr">
                            {feesKnown ? fmt(feesSum, 2) : "—"}
                          </b>{" "}
                          ر.س
                        </span>
                      </span>
                    </div>
                  </Td>
                </Tr>

                {open
                  ? group.map((row) => {
                      const total = revenueAmountsFromRow(row).total;
                      const statusLabel: { t: string; style: StatusPillStyle } = (() => {
                        if (row.invoiceNumber?.trim()) {
                          return {
                            t: "مفوتر جزئياً",
                            style: finStatusStyle("warning"),
                          };
                        }
                        const w = (row.workStatusLabel || "").trim();
                        if (w) return { t: w, style: finStatusStyle("default") };
                        return { t: "لم يستحق بعد", style: finStatusStyle("default") };
                      })();
                      return (
                        <Tr key={`${row.poNumber}-${row.propertyId}`}>
                          <Td>
                            <div className="flex min-w-0 flex-col items-start gap-1">
                              <DeedCell deed={row.deedNumber} />
                              {row.propertyLabel?.trim() &&
                              row.propertyLabel !== row.deedNumber ? (
                                <span className="max-w-full truncate text-[11px] leading-snug text-text-3">
                                  {row.propertyLabel}
                                </span>
                              ) : null}
                            </div>
                          </Td>
                          <Td className="text-center">
                            <span className={finMuted}>
                              {(row.city || "—").trim() || "—"}
                            </span>
                          </Td>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {formatDateEn(row.completedAtUtc)}
                          </TdLtr>
                          <Td className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-2.5">
                                <FeeFlags row={row} />
                                <span className={finNum}>
                                  {total > 0 ? fmtSar(total) : "—"}
                                </span>
                              </span>
                              <StatusPill label={statusLabel.t} style={statusLabel.style} />
                            </div>
                          </Td>
                        </Tr>
                      );
                    })
                  : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

export function EligibleTable({
  rows,
  onOpenPo,
}: {
  rows: EnfazTrackingRowDto[];
  onOpenPo: (po: string) => void;
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        (b.completedAtUtc || "").localeCompare(a.completedAtUtc || ""),
      ),
    [rows],
  );

  return (
    <TableFrame>
      <Table className="min-w-[820px]">
        <RevenueTableHead
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
            "الإجراء",
          ]}
        />
        <TBody>
          {sorted.map((row) => {
            const total = revenueAmountsFromRow(row).total;
            return (
              <Tr key={`${row.poNumber}-${row.propertyId}`}>
                <Td className="text-center">
                  <PoCell po={row.poNumber} />
                </Td>
                <Td className="text-center">
                  <DeedCell deed={row.deedNumber} />
                </Td>
                <Td className="text-center">
                  <span className={finMuted}>
                    {(row.city || "—").trim() || "—"}
                  </span>
                </Td>
                <TdLtr className="text-center" valueClassName={finMuted}>
                  {formatDateEn(row.completedAtUtc)}
                </TdLtr>
                <Td className="text-center">
                  <span className="inline-flex items-center gap-2.5">
                    <FeeFlags row={row} />
                    <span className={finNum}>{fmtSar(total)}</span>
                  </span>
                </Td>
                <Td className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {!row.enfazFilled ? (
                      <button
                        type="button"
                        className={cn(opsBtnPrimary, "px-3 py-2 text-[11.5px]")}
                        onClick={() => onOpenPo(row.poNumber)}
                      >
                        مطابقة الأتعاب
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={cn(opsBtnGhost, "h-auto px-[11px] py-2 text-[11.5px]")}
                      title="تحديث حالة المعاملة كما هي في منصة إنفاذ"
                      onClick={() => onOpenPo(row.poNumber)}
                    >
                      تحديث حالة إنفاذ
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

export function BillingAssistantTable({
  rows,
  selected,
  onToggle,
  collapsed,
  onToggleGroup,
}: {
  rows: EnfazTrackingRowDto[];
  selected: Record<string, boolean>;
  onToggle: (propertyId: string) => void;
  collapsed: Record<string, boolean>;
  onToggleGroup: (po: string) => void;
}) {
  const colSpan = 9;
  const groups = useMemo(() => groupRowsByPo(rows), [rows]);

  return (
    <TableFrame>
      <Table className="min-w-[1080px]">
        <RevenueTableHead
          firstStart={false}
          heads={[
            "",
            "رقم الصك",
            "مساحة الأرض (م٢)",
            "مسطح البناء (م٢)",
            "أتعاب المفاتيح",
            "الأتعاب",
            "الضريبة",
            "شاملة الضريبة",
            "الإجمالي المستحق",
          ]}
        />
        <TBody>
          {groups.map(({ poNumber, rows: group }) => {
            const open = collapsed[poNumber] === true;
            let sBase = 0;
            let sVat = 0;
            let sKey = 0;
            let sGross = 0;
            for (const r of group) {
              const a = revenueAmountsFromRow(r);
              sBase += a.taxable;
              sVat += a.vat;
              sKey += a.key;
              sGross += a.total;
            }
            return (
              <Fragment key={poNumber}>
                <Tr
                  hoverable={false}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onToggleGroup(poNumber)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleGroup(poNumber);
                    }
                  }}
                >
                  <Td colSpan={colSpan} className={GROUP_TD}>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                      <span className="inline-flex flex-wrap items-center gap-[9px]">
                        <Chevron open={open} />
                        <span className="text-[12.5px] font-extrabold text-heading">
                          أمر العمل{" "}
                          <span dir="ltr">{poNumber}</span>
                        </span>
                        <span className="text-[11px] text-text-3">
                          {group.length} معاملة · الإجمالي المستحق{" "}
                          <b className="text-heading" dir="ltr">
                            {fmt(sGross, 2)}
                          </b>{" "}
                          ر.س
                        </span>
                      </span>
                    </div>
                  </Td>
                </Tr>
                {open
                  ? group.map((row) => {
                      const a = revenueAmountsFromRow(row);
                      const on = !!selected[row.propertyId];
                      return (
                        <Tr
                          key={row.propertyId}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "cursor-pointer",
                            on &&
                              "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                          )}
                          onClick={() => onToggle(row.propertyId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggle(row.propertyId);
                            }
                          }}
                        >
                          <Td className="text-center">
                            <input
                              type="checkbox"
                              className={opsCheckInput}
                              checked={on}
                              onChange={() => onToggle(row.propertyId)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`تحديد ${row.deedNumber}`}
                            />
                          </Td>
                          <Td className="text-center">
                            <DeedCell deed={row.deedNumber} />
                          </Td>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {(row.landArea || "—").trim() || "—"}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            —
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.key, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.taxable, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.vat, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.withVat, 2)}
                          </TdLtr>
                          <Td className="text-center">
                            <span className="inline-flex items-center gap-2.5">
                              <FeeFlags row={row} />
                              <span
                                className="text-[12.5px] font-bold text-heading"
                                dir="ltr"
                              >
                                {fmt(a.total, 2)}
                              </span>
                            </span>
                          </Td>
                        </Tr>
                      );
                    })
                  : null}
                {open ? (
                  <Tr hoverable={false}>
                    <Td className={cn(TOT_TD, "text-center")} />
                    <Td className={cn(TOT_TD, "text-center")}>
                      <span className="text-[11px] font-extrabold text-heading">
                        إجمالي أمر العمل
                      </span>
                    </Td>
                    <Td className={cn(TOT_TD, "text-center")} />
                    <Td className={cn(TOT_TD, "text-center")} />
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text-2"
                    >
                      {fmt(sKey, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text"
                    >
                      {fmt(sBase, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text-2"
                    >
                      {fmt(sVat, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text"
                    >
                      {fmt(sBase + sVat, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[12.5px] font-extrabold text-heading"
                    >
                      {fmt(sGross, 2)}
                    </TdLtr>
                  </Tr>
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

export function CollectionTable({
  rows,
  collapsed,
  onToggleGroup,
  onCollect,
  onFollow,
}: {
  rows: EnfazTrackingRowDto[];
  collapsed: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onCollect: (po: string) => void;
  onFollow: (po: string) => void;
}) {
  const colSpan = 5;
  const groups = useMemo(() => groupRowsByInvoice(rows), [rows]);

  return (
    <TableFrame>
      <Table className="min-w-[720px]">
        <RevenueTableHead
          heads={[
            "رقم الصك",
            "تاريخ الاكتمال",
            "الأتعاب",
            "الضريبة",
            "الإجمالي المستحق",
          ]}
        />
        <TBody>
          {groups.map((group) => {
            const key = group.invoiceKey;
            const open = collapsed[key] === true;
            const iv = group.invoiceNumber;
            const age = rowAgeDays(group.rows[0]!) ?? 0;
            const fu = group.rows[0]?.followupCount ?? 0;
            const po = group.rows[0]?.poNumber ?? "";
            let sB = 0;
            let sV = 0;
            let sG = 0;
            for (const r of group.rows) {
              const a = revenueAmountsFromRow(r);
              sB += a.taxable;
              sV += a.vat;
              sG += a.total;
            }
            return (
              <Fragment key={key}>
                <Tr
                  hoverable={false}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onToggleGroup(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleGroup(key);
                    }
                  }}
                >
                  <Td colSpan={colSpan} className={GROUP_TD}>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                      <span className="inline-flex flex-wrap items-center gap-[9px]">
                        <Chevron open={open} />
                        <span className="text-[12.5px] font-extrabold text-heading">
                          فاتورة <span dir="ltr">{iv}</span>
                        </span>
                        <span className="text-[11px] text-text-3">
                          {group.rows.length} معاملة · الإجمالي{" "}
                          <b className="text-heading" dir="ltr">
                            {fmt(sG, 2)}
                          </b>{" "}
                          ر.س · عمر المستحق {age} يوماً
                          {fu > 0 ? ` · ${fu} متابعة` : ""}
                        </span>
                      </span>
                      <span
                        className="ms-auto inline-flex flex-wrap gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={cn(opsBtnPrimary, "px-3 py-[7px] text-[11.5px]")}
                          onClick={() => onCollect(po)}
                        >
                          تسجيل التحويل
                        </button>
                        <button
                          type="button"
                          className={cn(
                            opsBtnGhost,
                            "h-auto px-[11px] py-[7px] text-[11.5px]",
                          )}
                          onClick={() => onFollow(po)}
                        >
                          متابعة{fu > 0 ? ` (${fu})` : ""}
                        </button>
                      </span>
                    </div>
                  </Td>
                </Tr>
                {open
                  ? group.rows.map((row) => {
                      const a = revenueAmountsFromRow(row);
                      return (
                        <Tr key={row.propertyId}>
                          <Td className="text-center">
                            <DeedCell deed={row.deedNumber} />
                          </Td>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {formatDateEn(row.completedAtUtc)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName="text-xs text-text">
                            {fmt(a.taxable, 2)}
                          </TdLtr>
                          <TdLtr className="text-center" valueClassName={finMuted}>
                            {fmt(a.vat, 2)}
                          </TdLtr>
                          <TdLtr
                            className="text-center"
                            valueClassName="text-[12.5px] font-bold text-heading"
                          >
                            {fmt(a.total, 2)}
                          </TdLtr>
                        </Tr>
                      );
                    })
                  : null}
                {open ? (
                  <Tr hoverable={false}>
                    <Td className={cn(TOT_TD, "text-center")}>
                      <span className="text-[11px] font-extrabold text-heading">
                        إجمالي الفاتورة
                      </span>
                    </Td>
                    <Td className={cn(TOT_TD, "text-center")} />
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text"
                    >
                      {fmt(sB, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[11.5px] font-bold text-text-2"
                    >
                      {fmt(sV, 2)}
                    </TdLtr>
                    <TdLtr
                      className={cn(TOT_TD, "text-center")}
                      valueClassName="text-[12.5px] font-extrabold text-heading"
                    >
                      {fmt(sG, 2)}
                    </TdLtr>
                  </Tr>
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

export function CollectedTable({ rows }: { rows: EnfazTrackingRowDto[] }) {
  return (
    <TableFrame>
      <Table className="min-w-[960px]">
        <RevenueTableHead
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
            "الفاتورة",
            "تاريخ التحويل",
            "الحالة",
          ]}
        />
        <TBody>
          {rows.map((row) => {
            const total = revenueAmountsFromRow(row).total;
            return (
              <Tr key={`${row.poNumber}-${row.propertyId}`}>
                <Td className="text-center">
                  <PoCell po={row.poNumber} />
                </Td>
                <Td className="text-center">
                  <DeedCell deed={row.deedNumber} />
                </Td>
                <Td className="text-center">
                  <span className={finMuted}>
                    {(row.city || "—").trim() || "—"}
                  </span>
                </Td>
                <TdLtr className="text-center" valueClassName={finMuted}>
                  {formatDateEn(row.completedAtUtc)}
                </TdLtr>
                <Td className="text-center">
                  <span className="inline-flex items-center gap-2.5">
                    <FeeFlags row={row} />
                    <span className={finNum}>{fmtSar(total)}</span>
                  </span>
                </Td>
                <Td className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-bold text-text" dir="ltr">
                      {(row.invoiceNumber || "—").trim() || "—"}
                    </span>
                    <span className="text-[10.5px] text-text-3" dir="ltr">
                      {formatDateEn(row.invoiceIssuedAtUtc)}
                    </span>
                  </div>
                </Td>
                <TdLtr className="text-center" valueClassName={finMuted}>
                  —
                </TdLtr>
                <Td className="text-center">
                  <StatusPill label="محصّلة" style={finStatusStyle("success")} />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

export function StoppedTable({
  rows,
  onRecall,
  mode = "stopped",
}: {
  rows: EnfazTrackingRowDto[];
  onRecall?: (po: string) => void;
  /** stopped = recall action · excluded = display only */
  mode?: "stopped" | "excluded";
}) {
  const reasonHead = mode === "excluded" ? "سبب الاستبعاد" : "سبب التوقف";
  const showAction = mode === "stopped" && onRecall != null;
  return (
    <TableFrame>
      <Table className="min-w-[820px]">
        <RevenueTableHead
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            reasonHead,
            "الإجراء",
          ]}
        />
        <TBody>
          {rows.map((row) => (
            <Tr key={`${row.poNumber}-${row.propertyId}`}>
              <Td className="text-center">
                <PoCell po={row.poNumber} />
                {row.isOverdue ? (
                  <StatusPill
                    label="متأخر"
                    style={finStatusStyle("danger")}
                    className="ms-1.5 text-[10px]"
                  />
                ) : null}
              </Td>
              <Td className="text-center">
                <DeedCell deed={row.deedNumber} />
              </Td>
              <Td className="text-center">
                <span className={finMuted}>{(row.city || "—").trim() || "—"}</span>
              </Td>
              <TdLtr className="text-center" valueClassName={finMuted}>
                {formatDateEn(row.completedAtUtc)}
              </TdLtr>
              <Td className="text-center">
                <span className="text-start text-xs text-text-2">
                  {stoppedReasonLabel(row)}
                </span>
              </Td>
              <Td className="text-center">
                {showAction ? (
                  <button
                    type="button"
                    className={cn(opsBtnGhost, "h-auto px-3 py-[7px] text-[11.5px]")}
                    onClick={() => onRecall!(row.poNumber)}
                  >
                    استدعاء — تحديث الحالة
                  </button>
                ) : (
                  <span className="text-[12px] text-text-3">عرض فقط</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}