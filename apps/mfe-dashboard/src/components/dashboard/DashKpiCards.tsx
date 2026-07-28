"use client";

import { useRouter } from "next/navigation";
import { RingCap } from "../../lib/dash-svg";
import type { DashKpiModel } from "../../lib/dashboard-metrics";
import { dashKpi } from "../../lib/dashboard-tw";

export function DashKpiCards({
  kpis,
  pending,
}: {
  kpis: DashKpiModel;
  pending?: boolean;
}) {
  const router = useRouter();
  const v = (n: number) => (pending ? "—" : String(n));

  return (
    <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <button
        type="button"
        className={dashKpi}
        onClick={() => router.push("/po")}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-text-2">
            أوامر قيد العمل
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[28px] font-extrabold leading-none text-heading">
              {v(kpis.activeOrders)}
            </div>
            <div className="mt-1.5 truncate text-[11px] text-text-3">
              {pending
                ? "…"
                : kpis.atRisk
                  ? `${kpis.atRisk} قاربت/تجاوزت المهلة`
                  : "كلها ضمن المهلة"}
            </div>
          </div>
          <RingCap
            pct={kpis.atRiskPct}
            color={kpis.atRisk ? "#d9694f" : "#3f8f5f"}
            cap="قاربت المهلة"
          />
        </div>
      </button>

      <button
        type="button"
        className={dashKpi}
        onClick={() => router.push("/all-transactions")}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-text-2">
            عقارات قيد المعالجة
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[28px] font-extrabold leading-none text-heading">
              {v(kpis.propsLeft)}
            </div>
            <div className="mt-1.5 truncate text-[11px] text-text-3">
              {pending ? "…" : `من ${kpis.totalProps} عقاراً`}
            </div>
          </div>
          <RingCap
            pct={kpis.inProcPct}
            color="var(--ink)"
            cap="قيد المعالجة"
          />
        </div>
      </button>

      <button
        type="button"
        className={dashKpi}
        onClick={() => router.push("/operations-tasks")}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-text-2">
            مهام تتطلب إجراءك
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[28px] font-extrabold leading-none text-heading">
              {v(kpis.openTasks)}
            </div>
            <div className="mt-1.5 truncate text-[11px] text-text-3">
              {pending
                ? "…"
                : kpis.overdueTasks
                  ? `${kpis.overdueTasks} متأخرة`
                  : "ضمن المهلة"}
            </div>
          </div>
          <RingCap
            pct={kpis.overduePct}
            color={kpis.overduePct > 0 ? "#d9694f" : "#3f8f5f"}
            cap="متأخرة"
          />
        </div>
      </button>

      <button
        type="button"
        className={dashKpi}
        onClick={() => router.push("/failures")}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-text-2">
            تعذرات ومعلّقات
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[28px] font-extrabold leading-none text-heading">
              {v(kpis.failuresOpen + kpis.stopped)}
            </div>
            <div className="mt-1.5 truncate text-[11px] text-text-3">
              {pending
                ? "…"
                : `${kpis.failuresOpen} تعذر · ${kpis.stopped} متوقفة`}
            </div>
          </div>
          <RingCap
            pct={kpis.stoppedPct}
            color="#d9694f"
            cap="متوقفة من النشطة"
          />
        </div>
      </button>
    </div>
  );
}
