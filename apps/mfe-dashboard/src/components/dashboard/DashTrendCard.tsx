"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "../../lib/dash-svg";
import {
  TREND_COLORS,
  TREND_DATA,
  TREND_QUARTER_LABELS,
} from "../../lib/dashboard-mock";
import { dashCard } from "../../lib/dashboard-tw";
import { cn } from "@platform/design-system";

type Mode = "month" | "quarter";

function seriesFor(year: string, mode: Mode): number[] {
  const raw = TREND_DATA[year as "2024" | "2025" | "2026"];
  if (!raw) return [];
  const a = [...raw];
  if (mode === "month") return a;
  const q = [0, 0, 0, 0];
  a.forEach((v, i) => {
    q[Math.floor(i / 3)] += v;
  });
  return q;
}

export function DashTrendCard() {
  const [mode, setMode] = useState<Mode>("month");
  const [years, setYears] = useState<Record<string, boolean>>({
    "2024": false,
    "2025": true,
    "2026": true,
  });

  const enabled = Object.keys(years).filter((y) => years[y]);
  const labels = mode === "month" ? [...TREND_DATA.labels] : TREND_QUARTER_LABELS;

  const series = useMemo(
    () =>
      enabled.map((year) => ({
        year,
        color: TREND_COLORS[year] ?? "var(--ink)",
        values: seriesFor(year, mode),
      })),
    [enabled, mode],
  );

  const latest = enabled.length
    ? String(Math.max(...enabled.map(Number)))
    : null;
  const growth = useMemo(() => {
    if (!latest) return null;
    const vals = seriesFor(latest, mode);
    if (vals.length < 2) return null;
    const a = vals[vals.length - 2];
    const b = vals[vals.length - 1];
    if (!a) return null;
    const pct = Math.round(((b - a) / a) * 100);
    return { pct, up: pct >= 0 };
  }, [latest, mode]);

  const toggleYear = (y: string) => {
    const on = Object.keys(years).filter((k) => years[k]);
    if (years[y] && on.length <= 1) return;
    setYears((prev) => ({ ...prev, [y]: !prev[y] }));
  };

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
          {(["2024", "2025", "2026"] as const).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => toggleYear(y)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11.5px] font-bold transition-colors",
                years[y]
                  ? "border-transparent text-white"
                  : "border-border-md bg-surface text-text-3",
              )}
              style={
                years[y]
                  ? { background: TREND_COLORS[y], borderColor: TREND_COLORS[y] }
                  : undefined
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      {growth ? (
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
      ) : null}
      <TrendChart labels={labels} series={series} />
    </div>
  );
}
