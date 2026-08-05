"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import { cn } from "@platform/design-system";
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
  finCard,
  finCheck,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finFilters,
  finGhost,
  finGridRevBilling,
  finGridRevCollect,
  finGridRevCollected,
  finGridRevEligible,
  finGridRevStopped,
  finGridRevStudy,
  finGroupRow,
  finMuted,
  finNum,
  finPo,
  finPrimary,
  finRow,
  finScroll,
  finSearch,
  finSearchIcon,
  finSearchInput,
  finSel,
  finSelCtrl,
  finCaret,
  finStatus,
  finStatusGold,
  finStatusGreen,
  finStatusRed,
  finTd,
  finTh,
  finThead,
  finTotRow,
  finWork,
  finWorkHead,
  finWorkTitle,
} from "../lib/finance-tw";
import { FinanceStagePills } from "./FinanceStagePills";
import { FinanceEnfazPoBilling } from "./FinanceEnfazPoBilling";
import { FinanceEnfazFollowupsPanel } from "./FinanceEnfazFollowupsPanel";

function fmtNum(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtSar(n: number) {
  return `${fmtNum(n, n % 1 === 0 ? 0 : 2)} ر.س`;
}

function filterRows(
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

function SearchIcon() {
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

function Chevron({ open }: { open: boolean }) {
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

/** أيقونات بنود الأتعاب (مفاتيح + رفع مساحي) بجانب المبلغ */
function FeeFlags({ row }: { row: EnfazTrackingRowDto }) {
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
            ? "أتعاب مكتب هندسي — رفع مساحي"
            : "أتعاب مكتب هندسي — غير مفعّل"
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

function DeedCell({ deed }: { deed: string }) {
  return (
    <span className="text-[12.5px] font-bold text-gold-d" dir="ltr">
      {(deed || "—").trim() || "—"}
    </span>
  );
}

function PoCell({ po }: { po: string }) {
  return (
    <span className="text-[12px] font-semibold text-ink" dir="ltr">
      {po}
    </span>
  );
}

function Thead({
  cols,
  heads,
  firstStart = true,
}: {
  cols: string;
  heads: string[];
  firstStart?: boolean;
}) {
  return (
    <div className={cn(finThead, cols)}>
      {heads.map((h, i) => (
        <div
          key={`${h}-${i}`}
          className={cn(
            finTh,
            (!firstStart || i > 0) && "!justify-center !text-center",
          )}
        >
          {h}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ stage }: { stage: RevenueStage }) {
  return (
    <div className={finCard}>
      <div className={finEmpty}>
        <div className={finEmptyT}>
          {stage === "stopped"
            ? "لا معاملات متوقفة."
            : stage === "excluded"
              ? "لا مستبعدة حالياً."
              : "لا معاملات في هذه المرحلة."}
        </div>
        {revenueStageEmptyHint(stage) ? (
          <div className={finEmptyS}>{revenueStageEmptyHint(stage)}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── stage tables ─── */

function StudyTable({
  rows,
  allRows,
  collapsed,
  onToggleGroup,
}: {
  rows: EnfazTrackingRowDto[];
  /** كل صفوف التتبّع — لحساب «X من Y» داخل أمر العمل */
  allRows: EnfazTrackingRowDto[];
  collapsed: Record<string, boolean>;
  onToggleGroup: (po: string) => void;
}) {
  const cols = finGridRevStudy;
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
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
          heads={[
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
          ]}
        />
        {groups.map(({ poNumber, rows: group }) => {
          const open = collapsed[poNumber] !== true;
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
            <div key={poNumber}>
              <div
                className={finGroupRow}
                role="button"
                tabIndex={0}
                onClick={() => onToggleGroup(poNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleGroup(poNumber);
                  }
                }}
              >
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
                        {feesKnown ? fmtNum(feesSum) : "—"}
                      </b>{" "}
                      ر.س
                    </span>
                  </span>
                </div>
              </div>

              {open
                ? group.map((row) => {
                    const total = revenueAmountsFromRow(row).total;
                    const statusLabel = (() => {
                      if (row.invoiceNumber?.trim()) {
                        return {
                          t: "مفوتر جزئياً",
                          cls: finStatusGold,
                        };
                      }
                      const w = (row.workStatusLabel || "").trim();
                      if (w) return { t: w, cls: finStatus };
                      return { t: "لم يستحق بعد", cls: finStatus };
                    })();
                    return (
                      <div
                        key={`${row.poNumber}-${row.propertyId}`}
                        className={cn(finRow, cols)}
                      >
                        <div className={cn(finTd, "!justify-start !text-start")}>
                          <div className="flex min-w-0 flex-col items-start gap-1">
                            <DeedCell deed={row.deedNumber} />
                            {row.propertyLabel?.trim() &&
                            row.propertyLabel !== row.deedNumber ? (
                              <span className="max-w-full truncate text-[11px] leading-snug text-text-3">
                                {row.propertyLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted}>
                            {(row.city || "—").trim() || "—"}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {formatDateEn(row.completedAtUtc)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-2.5">
                              <FeeFlags row={row} />
                              <span className={finNum}>
                                {total > 0 ? fmtSar(total) : "—"}
                              </span>
                            </span>
                            <span className={statusLabel.cls}>
                              {statusLabel.t}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EligibleTable({
  rows,
  onOpenPo,
}: {
  rows: EnfazTrackingRowDto[];
  onOpenPo: (po: string) => void;
}) {
  const cols = finGridRevEligible;
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        (b.completedAtUtc || "").localeCompare(a.completedAtUtc || ""),
      ),
    [rows],
  );

  return (
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            "إجمالي الأتعاب",
            "الإجراء",
          ]}
        />
        {sorted.map((row) => {
          const total = revenueAmountsFromRow(row).total;
          return (
            <div
              key={`${row.poNumber}-${row.propertyId}`}
              className={cn(finRow, cols)}
            >
              <div className={finTd}>
                <PoCell po={row.poNumber} />
              </div>
              <div className={finTd}>
                <DeedCell deed={row.deedNumber} />
              </div>
              <div className={finTd}>
                <span className={finMuted}>
                  {(row.city || "—").trim() || "—"}
                </span>
              </div>
              <div className={finTd}>
                <span className={finMuted} dir="ltr">
                  {formatDateEn(row.completedAtUtc)}
                </span>
              </div>
              <div className={finTd}>
                <span className="inline-flex items-center gap-2.5">
                  <FeeFlags row={row} />
                  <span className={finNum}>{fmtSar(total)}</span>
                </span>
              </div>
              <div className={finTd}>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {!row.enfazFilled ? (
                    <button
                      type="button"
                      className={cn(finPrimary, "px-3 py-2 text-[11.5px]")}
                      onClick={() => onOpenPo(row.poNumber)}
                    >
                      مطابقة الأتعاب
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn(finGhost, "h-auto px-[11px] py-2 text-[11.5px]")}
                    title="تحديث حالة المعاملة كما هي في منصة إنفاذ"
                    onClick={() => onOpenPo(row.poNumber)}
                  >
                    تحديث حالة إنفاذ
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingAssistantTable({
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
  const cols = finGridRevBilling;
  const groups = useMemo(() => groupRowsByPo(rows), [rows]);

  return (
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
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
        {groups.map(({ poNumber, rows: group }) => {
          const open = collapsed[poNumber] !== true;
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
            <div key={poNumber}>
              <div
                className={finGroupRow}
                role="button"
                tabIndex={0}
                onClick={() => onToggleGroup(poNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleGroup(poNumber);
                  }
                }}
              >
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
                        {fmtNum(sGross)}
                      </b>{" "}
                      ر.س
                    </span>
                  </span>
                </div>
              </div>
              {open
                ? group.map((row) => {
                    const a = revenueAmountsFromRow(row);
                    const on = !!selected[row.propertyId];
                    return (
                      <div
                        key={row.propertyId}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          finRow,
                          cols,
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
                        <div className={finTd}>
                          <input
                            type="checkbox"
                            className={finCheck}
                            checked={on}
                            onChange={() => onToggle(row.propertyId)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`تحديد ${row.deedNumber}`}
                          />
                        </div>
                        <div className={finTd}>
                          <DeedCell deed={row.deedNumber} />
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {(row.landArea || "—").trim() || "—"}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            —
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {fmtNum(a.key)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className="text-xs text-text" dir="ltr">
                            {fmtNum(a.taxable)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {fmtNum(a.vat)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className="text-xs text-text" dir="ltr">
                            {fmtNum(a.withVat)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className="inline-flex items-center gap-2.5">
                            <FeeFlags row={row} />
                            <span className="text-[12.5px] font-bold text-heading" dir="ltr">
                              {fmtNum(a.total)}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                : null}
              {open ? (
                <div className={cn(finTotRow, cols)}>
                  <div className={finTd} />
                  <div className={finTd}>
                    <span className="text-[11px] font-extrabold text-heading">
                      إجمالي أمر العمل
                    </span>
                  </div>
                  <div className={finTd} />
                  <div className={finTd} />
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text-2" dir="ltr">
                      {fmtNum(sKey)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text" dir="ltr">
                      {fmtNum(sBase)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text-2" dir="ltr">
                      {fmtNum(sVat)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text" dir="ltr">
                      {fmtNum(sBase + sVat)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[12.5px] font-extrabold text-heading" dir="ltr">
                      {fmtNum(sGross)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollectionTable({
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
  const cols = finGridRevCollect;
  const groups = useMemo(() => groupRowsByInvoice(rows), [rows]);

  return (
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
          heads={[
            "رقم الصك",
            "تاريخ الاكتمال",
            "الأتعاب",
            "الضريبة",
            "الإجمالي المستحق",
          ]}
        />
        {groups.map((group) => {
          const key = group.invoiceKey;
          const open = collapsed[key] !== true;
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
            <div key={key}>
              <div
                className={finGroupRow}
                role="button"
                tabIndex={0}
                onClick={() => onToggleGroup(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleGroup(key);
                  }
                }}
              >
                <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
                  <span className="inline-flex flex-wrap items-center gap-[9px]">
                    <Chevron open={open} />
                    <span className="text-[12.5px] font-extrabold text-heading">
                      فاتورة <span dir="ltr">{iv}</span>
                    </span>
                    <span className="text-[11px] text-text-3">
                      {group.rows.length} معاملة · الإجمالي{" "}
                      <b className="text-heading" dir="ltr">
                        {fmtNum(sG)}
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
                      className={cn(finPrimary, "px-3 py-[7px] text-[11.5px]")}
                      onClick={() => onCollect(po)}
                    >
                      تسجيل التحويل
                    </button>
                    <button
                      type="button"
                      className={cn(
                        finGhost,
                        "h-auto px-[11px] py-[7px] text-[11.5px]",
                      )}
                      onClick={() => onFollow(po)}
                    >
                      متابعة{fu > 0 ? ` (${fu})` : ""}
                    </button>
                  </span>
                </div>
              </div>
              {open
                ? group.rows.map((row) => {
                    const a = revenueAmountsFromRow(row);
                    return (
                      <div
                        key={row.propertyId}
                        className={cn(finRow, cols)}
                      >
                        <div className={finTd}>
                          <DeedCell deed={row.deedNumber} />
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {formatDateEn(row.completedAtUtc)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className="text-xs text-text" dir="ltr">
                            {fmtNum(a.taxable)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className={finMuted} dir="ltr">
                            {fmtNum(a.vat)}
                          </span>
                        </div>
                        <div className={finTd}>
                          <span className="text-[12.5px] font-bold text-heading" dir="ltr">
                            {fmtNum(a.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                : null}
              {open ? (
                <div className={cn(finTotRow, cols)}>
                  <div className={finTd}>
                    <span className="text-[11px] font-extrabold text-heading">
                      إجمالي الفاتورة
                    </span>
                  </div>
                  <div className={finTd} />
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text" dir="ltr">
                      {fmtNum(sB)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[11.5px] font-bold text-text-2" dir="ltr">
                      {fmtNum(sV)}
                    </span>
                  </div>
                  <div className={finTd}>
                    <span className="text-[12.5px] font-extrabold text-heading" dir="ltr">
                      {fmtNum(sG)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollectedTable({ rows }: { rows: EnfazTrackingRowDto[] }) {
  const cols = finGridRevCollected;
  return (
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
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
        {rows.map((row) => {
          const total = revenueAmountsFromRow(row).total;
          return (
            <div
              key={`${row.poNumber}-${row.propertyId}`}
              className={cn(finRow, cols)}
            >
              <div className={finTd}>
                <PoCell po={row.poNumber} />
              </div>
              <div className={finTd}>
                <DeedCell deed={row.deedNumber} />
              </div>
              <div className={finTd}>
                <span className={finMuted}>
                  {(row.city || "—").trim() || "—"}
                </span>
              </div>
              <div className={finTd}>
                <span className={finMuted} dir="ltr">
                  {formatDateEn(row.completedAtUtc)}
                </span>
              </div>
              <div className={finTd}>
                <span className="inline-flex items-center gap-2.5">
                  <FeeFlags row={row} />
                  <span className={finNum}>{fmtSar(total)}</span>
                </span>
              </div>
              <div className={finTd}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-bold text-text" dir="ltr">
                    {(row.invoiceNumber || "—").trim() || "—"}
                  </span>
                  <span className="text-[10.5px] text-text-3" dir="ltr">
                    {formatDateEn(row.invoiceIssuedAtUtc)}
                  </span>
                </div>
              </div>
              <div className={finTd}>
                <span className={finMuted} dir="ltr">
                  —
                </span>
              </div>
              <div className={finTd}>
                <span className={finStatusGreen}>محصّلة</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoppedTable({
  rows,
  onRecall,
  mode = "stopped",
}: {
  rows: EnfazTrackingRowDto[];
  onRecall?: (po: string) => void;
  /** stopped = إجراء استدعاء · excluded = عرض فقط */
  mode?: "stopped" | "excluded";
}) {
  const cols = finGridRevStopped;
  const reasonHead = mode === "excluded" ? "سبب الاستبعاد" : "سبب التوقف";
  const showAction = mode === "stopped" && onRecall != null;
  return (
    <div className={finCard}>
      <div className={finScroll}>
        <Thead
          cols={cols}
          heads={[
            "رقم الطلب",
            "رقم الصك",
            "المدينة",
            "تاريخ الاكتمال",
            reasonHead,
            "الإجراء",
          ]}
        />
        {rows.map((row) => (
          <div
            key={`${row.poNumber}-${row.propertyId}`}
            className={cn(finRow, cols)}
          >
            <div className={finTd}>
              <PoCell po={row.poNumber} />
              {row.isOverdue ? (
                <span className={cn(finStatusRed, "ms-1.5 text-[10px]")}>
                  متأخر
                </span>
              ) : null}
            </div>
            <div className={finTd}>
              <DeedCell deed={row.deedNumber} />
            </div>
            <div className={finTd}>
              <span className={finMuted}>{(row.city || "—").trim() || "—"}</span>
            </div>
            <div className={finTd}>
              <span className={finMuted} dir="ltr">
                {formatDateEn(row.completedAtUtc)}
              </span>
            </div>
            <div className={finTd}>
              <span className="text-start text-xs text-text-2">
                {stoppedReasonLabel(row)}
              </span>
            </div>
            <div className={finTd}>
              {showAction ? (
                <button
                  type="button"
                  className={cn(finGhost, "h-auto px-3 py-[7px] text-[11.5px]")}
                  onClick={() => onRecall!(row.poNumber)}
                >
                  استدعاء — تحديث الحالة
                </button>
              ) : (
                <span className="text-[12px] text-text-3">عرض فقط</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main view ─── */

export function FinanceRevenueView({
  stage,
  onStageChange,
  focusPo,
  onFocusPo,
}: {
  stage: RevenueStage;
  onStageChange: (stage: RevenueStage) => void;
  focusPo: string | null;
  /** forStage = مرحلة العرض الحالية حتى لا يُكتب stage قديم في الرابط */
  onFocusPo: (po: string | null, forStage?: RevenueStage) => void;
}) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "30" | "90">("all");
  const [city, setCity] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [followMode, setFollowMode] = useState(false);
  /**
   * مرحلة العرض الفورية — لا تعتمد على تأخّر searchParams بعد النقر،
   * وإلا يظهر عدّاد تبويب ومحتوى مرحلة أخرى.
   */
  const [viewStage, setViewStage] = useState(stage);

  useEffect(() => {
    setViewStage(stage);
  }, [stage]);

  const trackingQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking", "revenue"],
    queryFn: loadEnfazTracking,
    staleTime: 20_000,
  });

  const allRows = trackingQuery.data ?? [];
  const cities = useMemo(() => uniqueCities(allRows), [allRows]);
  const buckets = useMemo(() => bucketRevenueRows(allRows), [allRows]);

  /** صفوف كل مرحلة بعد نفس فلاتر البحث/المدينة/الفترة — العدّادات = ما يُعرض */
  const filteredBuckets = useMemo(() => {
    const next = {} as Record<RevenueStage, EnfazTrackingRowDto[]>;
    for (const s of REVENUE_STAGES) {
      next[s.id] = filterRows(buckets[s.id] ?? [], search, city, period);
    }
    return next;
  }, [buckets, search, city, period]);

  const counts = useMemo(() => {
    const next: Partial<Record<RevenueStage, number>> = {};
    for (const s of REVENUE_STAGES) {
      next[s.id] = filteredBuckets[s.id]?.length ?? 0;
    }
    return next;
  }, [filteredBuckets]);

  const stageRows = useMemo(
    () => filteredBuckets[viewStage] ?? [],
    [filteredBuckets, viewStage],
  );

  /** إعادة تعيين التحديد عند تغيير المرحلة */
  useEffect(() => {
    setSelected({});
    setFollowMode(false);
  }, [viewStage]);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelect = (propertyId: string) => {
    setSelected((prev) => ({ ...prev, [propertyId]: !prev[propertyId] }));
  };

  const allSelected =
    stageRows.length > 0 && stageRows.every((r) => selected[r.propertyId]);
  const selectedRows = stageRows.filter((r) => selected[r.propertyId]);
  const selectedTotal = selectedRows.reduce(
    (s, r) => s + revenueAmountsFromRow(r).total,
    0,
  );

  const selectAll = () => {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const r of stageRows) next[r.propertyId] = true;
    setSelected(next);
  };

  const openPo = (po: string, follow = false) => {
    setFollowMode(follow);
    onFocusPo(po, viewStage);
  };

  const showWorkPanel =
    focusPo != null &&
    (viewStage === "eligible" ||
      viewStage === "billing_assistant" ||
      viewStage === "awaiting_collection" ||
      viewStage === "stopped");

  const onInvoiceSelected = () => {
    if (selectedRows.length === 0) return;
    // أول أمر عمل ضمن المحدد — التجميع للعرض فقط
    openPo(selectedRows[0]!.poNumber);
  };

  const changeStage = (id: RevenueStage) => {
    setViewStage(id);
    // setStage يصفّر po ويحدّث الرابط
    onStageChange(id);
  };

  return (
    <div>
      <FinanceStagePills
        items={REVENUE_STAGES}
        active={viewStage}
        onChange={changeStage}
        counts={counts}
      />

      {/* ترتيب HTML: بحث (يمين · flex:1) → مدينة → فترة */}
      <div className={finFilters}>
        <div className={finSearch}>
          <SearchIcon />
          <input
            className={finSearchInput}
            placeholder="بحث: رقم الطلب · رقم الصك · رقم الفاتورة"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث الإيرادات"
          />
        </div>
        <div className={finSel}>
          <select
            className={finSelCtrl}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="المدينة"
          >
            <option value="all">كل المدن</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className={finCaret} aria-hidden>
            ▾
          </span>
        </div>
        <div className={finSel}>
          <select
            className={finSelCtrl}
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as "all" | "30" | "90")
            }
            aria-label="الفترة"
          >
            <option value="all">كل الفترات</option>
            <option value="30">آخر ٣٠ يوماً</option>
            <option value="90">آخر ٩٠ يوماً</option>
          </select>
          <span className={finCaret} aria-hidden>
            ▾
          </span>
        </div>
      </div>

      {viewStage === "billing_assistant" ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className={cn(
              finGhost,
              "h-auto px-3.5 py-2 text-xs",
              stageRows.length === 0 && "pointer-events-none opacity-50",
            )}
            onClick={selectAll}
          >
            {allSelected
              ? "إلغاء التحديد"
              : `تحديد الكل (${stageRows.length})`}
          </button>
          <button
            type="button"
            className={cn(
              finPrimary,
              "px-4 py-2 text-[12.5px]",
              selectedRows.length === 0 && "pointer-events-none opacity-50",
            )}
            onClick={onInvoiceSelected}
          >
            تسجيل فاتورة للمحدد
            {selectedRows.length
              ? ` (${selectedRows.length} — ${fmtNum(selectedTotal)} ر.س)`
              : ""}
          </button>
          <span className="text-[11px] text-text-3">
            اختر المعاملات الجاهزة وأضفها لفاتورة واحدة — التجميع تحت أمر العمل
            للعرض فقط.
          </span>
        </div>
      ) : null}

      {showWorkPanel ? (
        <div className={finWork}>
          <div className={finWorkHead}>
            <h3 className={finWorkTitle}>
              {viewStage === "stopped"
                ? "استدعاء ومتابعة — "
                : viewStage === "awaiting_collection"
                  ? followMode
                    ? "متابعة التحصيل — "
                    : "تسجيل التحويل — "
                  : viewStage === "billing_assistant"
                    ? "تسجيل الفاتورة — "
                    : "تحديث حالة إنفاذ / مطابقة — "}
              <span className={finPo} dir="ltr">
                {focusPo}
              </span>
            </h3>
            <button
              type="button"
              className={finGhost}
              onClick={() => {
                onFocusPo(null, viewStage);
                setFollowMode(false);
              }}
            >
              إغلاق
            </button>
          </div>
          {viewStage === "stopped" ? (
            <p className="mb-3 text-[12.5px] leading-[1.6] text-text-2">
              الفاتورة متأخرة عن موعد التحصيل، أو المعاملة جاهزة ولم تُرفع منذ
              30 يوماً. سجّل التحويل عند الاستلام أو وثّق المتابعة مع مركز
              التصفية.
            </p>
          ) : null}
          {viewStage !== "stopped" || !followMode ? (
            <FinanceEnfazPoBilling initialPo={focusPo} compact />
          ) : null}
          {(viewStage === "stopped" ||
            (viewStage === "awaiting_collection" && followMode)) &&
          focusPo ? (
            <FinanceEnfazFollowupsPanel poNumber={focusPo} />
          ) : null}
        </div>
      ) : null}

      {trackingQuery.isPending ? (
        <div className={finCard}>
          <div className={finEmpty}>
            <div className={finEmptyT}>جاري التحميل…</div>
          </div>
        </div>
      ) : stageRows.length === 0 ? (
        <EmptyState stage={viewStage} />
      ) : viewStage === "under_study" ? (
        <StudyTable
          rows={stageRows}
          allRows={allRows}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
        />
      ) : viewStage === "eligible" ? (
        <EligibleTable rows={stageRows} onOpenPo={(po) => openPo(po)} />
      ) : viewStage === "billing_assistant" ? (
        <BillingAssistantTable
          rows={stageRows}
          selected={selected}
          onToggle={toggleSelect}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
        />
      ) : viewStage === "awaiting_collection" ? (
        <CollectionTable
          rows={stageRows}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
          onCollect={(po) => openPo(po, false)}
          onFollow={(po) => openPo(po, true)}
        />
      ) : viewStage === "collected" ? (
        <CollectedTable rows={stageRows} />
      ) : viewStage === "excluded" ? (
        <StoppedTable rows={stageRows} mode="excluded" />
      ) : (
        <StoppedTable rows={stageRows} onRecall={(po) => openPo(po)} />
      )}
    </div>
  );
}
