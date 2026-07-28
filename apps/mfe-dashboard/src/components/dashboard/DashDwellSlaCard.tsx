"use client";

import { DWELL_SLA } from "../../lib/dashboard-mock";
import { dashCard } from "../../lib/dashboard-tw";

function fmtDays(v: number): string {
  return `${v % 1 === 0 ? v : v.toFixed(1)} ي`;
}

export function DashDwellSlaCard() {
  const dwMax = Math.max(...DWELL_SLA.map((r) => Math.max(r[1], r[2]))) * 1.12;
  const overCount = DWELL_SLA.filter((r) => r[1] > r[2]).length;

  return (
    <div className={dashCard}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          متوسط زمن المكوث لكل مرحلة
        </h3>
        {overCount ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#d9694f]">
            <span className="size-2 rounded-sm bg-[#d9694f]" />
            {overCount} مراحل تجاوزت الحد
          </span>
        ) : (
          <span className="text-[11.5px] font-bold text-[#3f8f5f]">
            لا تجاوزات على الحد
          </span>
        )}
      </div>
      {DWELL_SLA.map(([label, avg, lim]) => {
        const over = avg > lim;
        const c = over ? "#d9694f" : "var(--gold)";
        const w = Math.round((avg / dwMax) * 100);
        const limPct = Math.round((lim / dwMax) * 100);
        return (
          <div
            key={label}
            className="mb-[11px] flex items-center gap-2.5 text-[12.5px]"
          >
            <span className="w-[118px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-end text-text-2">
              {label}
            </span>
            <span className="relative h-3 flex-1 rounded-full bg-[color-mix(in_srgb,var(--text-3)_16%,transparent)]">
              <span
                className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-500"
                style={{ width: `${w}%`, background: c }}
              />
              <span
                title={`الحد ${fmtDays(lim)}`}
                className="absolute top-[-3px] h-[18px] w-0.5 bg-heading opacity-55"
                style={{ insetInlineStart: `${limPct}%` }}
              />
            </span>
            <span
              className="w-16 shrink-0 text-start font-bold"
              style={{ color: over ? "#d9694f" : "var(--heading)" }}
            >
              {fmtDays(avg)}
            </span>
          </div>
        );
      })}
      <div className="mt-2.5 text-[10.5px] text-text-3">
        الخط الرأسي يشير لحد المكوث التشغيلي لكل مرحلة · دورة المعاملة
        المتوقعة 4–5 أيام عمل
      </div>
    </div>
  );
}
