"use client";

import { opsDashCard } from "@platform/ui-kit";
import { BigRing } from "../../lib/dash-svg";
import type { DashCompletionModel } from "../../lib/dashboard-metrics";


export function DashCompletionCard({
  model,
  pending,
}: {
  model: DashCompletionModel;
  pending?: boolean;
}) {
  const segs: [string, number, string][] = [
    ["مرفوعة على إنفاذ", model.pDone, "#3f8f5f"],
    ["قيد الدراسة", model.pInProg, "var(--gold)"],
    ["غير مسجّلة", model.pNotReg, "#9aa3b2"],
  ];
  const total = model.pTotal || 1;
  const stats = [
    [pending ? "—" : String(model.pTotal), "إجمالي العقارات"],
    [pending ? "—" : `${model.regPct}%`, "نسبة التسجيل"],
    [pending ? "—" : model.avgPerPo, "متوسط/أمر"],
    [pending ? "—" : String(model.remaining), "متبقٍ"],
  ] as const;

  return (
    <div className={opsDashCard}>
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          إنجاز العقارات
        </h3>
      </div>
      {/* Phones: ring on top, the bar + legend full width under it. */}
      <div className="flex items-center gap-[18px] max-lg:flex-col max-lg:items-stretch">
        <div className="flex shrink-0 justify-center">
          <BigRing pct={pending ? 0 : model.compPct} color="#3f8f5f" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-4 overflow-hidden rounded-full bg-surface-2">
            {segs.map(([label, n, color]) => {
              const w = pending ? 0 : (n / total) * 100;
              if (w <= 0) return null;
              return (
                <div
                  key={label}
                  title={`${label}: ${n}`}
                  style={{ width: `${w}%`, background: color }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {segs.map(([label, n, color]) => {
              const w = pending || !model.pTotal ? 0 : Math.round((n / model.pTotal) * 100);
              return (
                <div
                  key={label}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: color }}
                  />
                  <span className="flex-1 text-text-2">{label}</span>
                  <span className="font-extrabold text-heading">
                    {pending ? "—" : n}
                  </span>
                  <span className="w-[38px] text-end text-text-3">{w}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Desktop: the four stats in one ruled row. */}
      <div className="mt-4 flex gap-2 border-t border-border pt-3.5 max-lg:hidden">
        {stats.map(([v, l]) => (
          <div key={l} className="flex-1 text-center">
            <div className="text-[19px] font-extrabold leading-none text-heading">
              {v}
            </div>
            <div className="mt-1 text-[11px] text-text-3">{l}</div>
          </div>
        ))}
      </div>
      {/* Phones: a 2×2 grid of separate stat tiles under the ring + legend. */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:hidden">
        {stats.map(([v, l]) => (
          <div
            key={l}
            className="min-w-0 rounded-[12px] border border-border bg-surface px-3 py-3 text-center"
          >
            <div
              dir="ltr"
              className="text-[22px] font-extrabold leading-none tabular-nums text-heading"
            >
              {v}
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-3">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
