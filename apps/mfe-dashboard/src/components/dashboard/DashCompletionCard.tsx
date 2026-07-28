"use client";

import Link from "next/link";
import { BigRing } from "../../lib/dash-svg";
import type { DashCompletionModel } from "../../lib/dashboard-metrics";
import { dashCard } from "../../lib/dashboard-tw";

export function DashCompletionCard({
  model,
  pending,
}: {
  model: DashCompletionModel;
  pending?: boolean;
}) {
  const segs: [string, number, string][] = [
    ["منجزة", model.pDone, "#3f8f5f"],
    ["قيد الدراسة", model.pInProg, "var(--gold)"],
    ["غير مسجّلة", model.pNotReg, "#9aa3b2"],
  ];
  const total = model.pTotal || 1;

  return (
    <div className={dashCard}>
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          إنجاز العقارات
        </h3>
        <Link
          href="/all-transactions"
          className="text-[12px] font-bold text-heading no-underline hover:underline"
        >
          جميع المعاملات
        </Link>
      </div>
      <div className="flex items-center gap-[18px]">
        <BigRing pct={pending ? 0 : model.compPct} color="#3f8f5f" />
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
      <div className="mt-4 flex gap-2 border-t border-border pt-3.5">
        {(
          [
            [pending ? "—" : String(model.pTotal), "إجمالي العقارات"],
            [pending ? "—" : `${model.regPct}%`, "نسبة التسجيل"],
            [pending ? "—" : model.avgPerPo, "متوسط/أمر"],
            [pending ? "—" : String(model.remaining), "متبقٍ"],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="flex-1 text-center">
            <div className="text-[19px] font-extrabold leading-none text-heading">
              {v}
            </div>
            <div className="mt-1 text-[11px] text-text-3">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
