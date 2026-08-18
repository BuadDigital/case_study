"use client";

import { useMemo, useState } from "react";
import type { ReportingCompletionYearDto } from "@platform/api-client";
import { TrendChart } from "../../lib/dash-svg";
import { dashCard } from "../../lib/dashboard-tw";
import { cn } from "@platform/ui-kit";

type Mode = "month" | "quarter";

const MONTH_LABELS = [
  "ينا",
  "فبر",
  "مار",
  "أبر",
  "ماي",
  "يون",
  "يول",
  "أغس",
  "سبت",
  "أكت",
  "نوف",
  "ديس",
];
const QUARTER_LABELS = ["ربع 1", "ربع 2", "ربع 3", "ربع 4"];

const YEAR_COLORS = ["#9aa3b2", "var(--ink)", "var(--gold-d)"];

function padMonthly(monthly: number[] | undefined): number[] {
  const base = [...(monthly ?? [])];
  while (base.length < 12) base.push(0);
  return base.slice(0, 12);
}

function toQuarterly(monthly: number[]): number[] {
  const q = [0, 0, 0, 0];
  monthly.forEach((v, i) => {
    q[Math.floor(i / 3)] += v;
  });
  return q;
}

export function DashTrendCard({
  years,
  pending,
}: {
  years: ReportingCompletionYearDto[];
  pending?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("month");
  const yearKeys = years.map((y) => String(y.year));
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const activeYears = useMemo(() => {
    if (yearKeys.length === 0) return [];
    const selected = yearKeys.filter((y) => enabled[y] !== false);
    return selected.length ? selected : [yearKeys[yearKeys.length - 1]!];
  }, [yearKeys, enabled]);

  const labels = mode === "month" ? MONTH_LABELS : QUARTER_LABELS;
  const colorByYear = useMemo(() => {
    const map: Record<string, string> = {};
    yearKeys.forEach((y, i) => {
      map[y] = YEAR_COLORS[i % YEAR_COLORS.length]!;
    });
    return map;
  }, [yearKeys]);

  const series = useMemo(
    () =>
      activeYears.map((year) => {
        const row = years.find((y) => String(y.year) === year);
        const monthly = padMonthly(row?.monthly);
        return {
          year,
          color: colorByYear[year] ?? "var(--ink)",
          values: mode === "month" ? monthly : toQuarterly(monthly),
        };
      }),
    [activeYears, years, mode, colorByYear],
  );

  const latest = activeYears.length
    ? String(Math.max(...activeYears.map(Number)))
    : null;
  const growth = useMemo(() => {
    if (!latest) return null;
    const row = series.find((s) => s.year === latest);
    const vals = row?.values ?? [];
    if (vals.length < 2) return null;
    const a = vals[vals.length - 2] ?? 0;
    const b = vals[vals.length - 1] ?? 0;
    if (!a) return b ? { pct: 100, up: true } : null;
    const pct = Math.round(((b - a) / a) * 100);
    return { pct, up: pct >= 0 };
  }, [latest, series]);

  const toggleYear = (y: string) => {
    const on = activeYears;
    if (on.includes(y) && on.length <= 1) return;
    setEnabled((prev) => ({ ...prev, [y]: prev[y] === false }));
  };

  const empty = !pending && years.every((y) => padMonthly(y.monthly).every((n) => n === 0));

  return (
    <div className={dashCard}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-bold text-heading">اتجاه الإنجاز</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["month", "شهري"],
              ["quarter", "ربعي"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                mode === m
                  ? "border-ink bg-ink text-white"
                  : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
          {yearKeys.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => toggleYear(y)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11.5px] font-bold transition-colors",
                activeYears.includes(y)
                  ? "border-transparent text-white"
                  : "border-border-md bg-surface text-text-3",
              )}
              style={
                activeYears.includes(y)
                  ? {
                      background: colorByYear[y],
                      borderColor: colorByYear[y],
                    }
                  : undefined
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      {growth && !empty ? (
        <div className="mb-2 text-[12px] text-text-3">
          آخر فترة مقابل السابقة:{" "}
          <span
            className="inline-flex items-center gap-0.5 font-bold"
            style={{ color: growth.up ? "#3f8f5f" : "#d9694f" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={growth.up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
            </svg>
            {growth.up ? "+" : ""}
            {growth.pct}%
          </span>
        </div>
      ) : (
        <div className="mb-2 text-[12px] text-text-3">
          {pending
            ? "جاري تحميل الإنجاز الفعلي…"
            : "عدد العقارات المكتملة حسب شهر إغلاق دراسة الحالة."}
        </div>
      )}
      <TrendChart labels={labels} series={series} />
    </div>
  );
}
