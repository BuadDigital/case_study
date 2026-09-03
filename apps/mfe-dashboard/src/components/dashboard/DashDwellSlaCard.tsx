"use client";

import type { ReportingStageDwellDto } from "@platform/api-client";
import { opsDashCard } from "@platform/ui-kit";


function fmtDays(v: number): string {
  return `${v % 1 === 0 ? v : v.toFixed(1)} ي`;
}

const STAGE_PLACEHOLDERS: ReportingStageDwellDto[] = [
  { key: "enfath", labelAr: "البيانات الأولية", avgDays: 0, slaDays: 1, sampleCount: 0, exceedsSla: false },
  { key: "bourse", labelAr: "البورصة", avgDays: 0, slaDays: 1, sampleCount: 0, exceedsSla: false },
  { key: "distribution", labelAr: "التوزيع", avgDays: 0, slaDays: 1, sampleCount: 0, exceedsSla: false },
  { key: "case-study", labelAr: "دراسة الحالة", avgDays: 0, slaDays: 2, sampleCount: 0, exceedsSla: false },
  { key: "government-review", labelAr: "المراجعة الحكومية", avgDays: 0, slaDays: 1.5, sampleCount: 0, exceedsSla: false },
  { key: "appraisal", labelAr: "التقييم والرفع", avgDays: 0, slaDays: 1.5, sampleCount: 0, exceedsSla: false },
];

export function DashDwellSlaCard({
  rows,
  pending,
}: {
  rows: ReportingStageDwellDto[];
  pending?: boolean;
}) {
  const stages = rows.length ? rows : STAGE_PLACEHOLDERS;
  const dwMax =
    Math.max(1, ...stages.map((r) => Math.max(r.avgDays, r.slaDays))) * 1.12;
  const overCount = stages.filter((r) => r.exceedsSla).length;
  const hasSamples = stages.some((r) => r.sampleCount > 0);

  return (
    <div className={opsDashCard}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          متوسط زمن المكوث لكل مرحلة
        </h3>
        {pending ? (
          <span className="text-[11.5px] text-text-3">جاري الحساب…</span>
        ) : overCount ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#d9694f]">
            <span className="size-2 rounded-sm bg-[#d9694f]" />
            {overCount} مراحل تجاوزت الحد
          </span>
        ) : hasSamples ? (
          <span className="text-[11.5px] font-bold text-[#3f8f5f]">
            لا تجاوزات على الحد
          </span>
        ) : (
          <span className="text-[11.5px] text-text-3">لا عينات بعد</span>
        )}
      </div>
      {stages.map((row) => {
        const over = row.exceedsSla;
        const c = over ? "#d9694f" : "var(--gold)";
        const w = Math.round((row.avgDays / dwMax) * 100);
        const limPct = Math.round((row.slaDays / dwMax) * 100);
        return (
          <div
            key={row.key}
            className="mb-[11px] flex items-center gap-2.5 text-[12.5px]"
          >
            <span className="w-[118px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-end text-text-2">
              {row.labelAr}
            </span>
            <span className="relative h-3 flex-1 rounded-full bg-[color-mix(in_srgb,var(--text-3)_16%,transparent)]">
              <span
                className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-500"
                style={{ width: `${pending ? 0 : w}%`, background: c }}
              />
              <span
                title={`الحد ${fmtDays(row.slaDays)}`}
                className="absolute top-[-3px] h-[18px] w-0.5 bg-heading opacity-55"
                style={{ insetInlineStart: `${limPct}%` }}
              />
            </span>
            <span
              className="w-[4.5rem] shrink-0 text-start font-bold"
              style={{ color: over ? "#d9694f" : "var(--heading)" }}
              title={
                row.sampleCount
                  ? `${row.sampleCount} مهمة في العينة`
                  : "لا مهام في هذه المرحلة"
              }
            >
              {pending || row.sampleCount === 0 ? "—" : fmtDays(row.avgDays)}
            </span>
          </div>
        );
      })}
      <div className="mt-2.5 text-[10.5px] text-text-3">
        من المهام الفعلية المفتوحة والمكتملة · الخط الرأسي حد المكوث التشغيلي ·
        دورة المعاملة المتوقعة 4–5 أيام عمل
      </div>
    </div>
  );
}
