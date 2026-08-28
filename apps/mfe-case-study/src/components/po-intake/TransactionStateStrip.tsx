import { apiConfig } from "@platform/app-shared/auth/api-config";
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, cn, useToast } from "@platform/ui-kit";
import { getAuthSession } from "@platform/auth-client";
import {
  getApiBase,
  getTransactionState,
  recordEnfazHandover,
  type TransactionStateDto,
} from "@platform/api-client";

/**
 * ق-9: شريط حالة المعاملة — الحالة مشتقة من حالات الأطراف والشاشة تعرض من ينتظر من.
 * الختام الثاني (رفع إنفاذ الشامل) يظهر زرّه عند جاهزيته فقط.
 */
export function TransactionStateStrip({
  workOrderId,
  propertyId,
}: {
  workOrderId: string;
  propertyId: string;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<TransactionStateDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const config = apiConfig();
    if (!config) return;
    const res = await getTransactionState(
      config,
      workOrderId,
      propertyId,
    );
    if (res.ok) setState(res.data);
  }, [workOrderId, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;

  const statusChip = (status: string) =>
    cn(
      "rounded-full px-2 py-[2px] text-[10.5px] font-bold",
      status === "completed"
        ? "bg-navy-soft text-ink"
        : status === "in_progress"
          ? "bg-gold-soft text-gold-d"
          : status === "waiting_on_party"
            ? "bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red"
            : "bg-surface-2 text-text-3",
    );

  const handover = async () => {
    const config = apiConfig();
    if (!config) return;
    setBusy(true);
    const res = await recordEnfazHandover(
      config,
      workOrderId,
      propertyId,
    );
    setBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر رفع المعاملة على إنفاذ", "error");
      return;
    }
    setState(res.data);
    showToast("رُفعت المعاملة على إنفاذ — التسليم الشامل (ق-9)", "success");
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] font-bold text-heading">
          شريط حالة المعاملة (ق-9)
          <span className={cn("ms-2", statusChip(state.overallStatus))}>
            {state.overallStatusLabelAr}
          </span>
        </div>
        {state.allowsEnfazHandover ? (
          <Button size="sm" disabled={busy} onClick={() => void handover()}>
            رفع المعاملة على إنفاذ (التسليم الشامل)
          </Button>
        ) : state.enfazHandoverAtUtc ? (
          <span className="text-[11px] font-semibold text-ink">
            مرفوعة على إنفاذ ✓
          </span>
        ) : null}
      </div>

      {/* المراحل */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {state.stages.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-[10px] text-text-3">←</span> : null}
            <span
              title={s.statusLabelAr}
              className={cn(statusChip(s.status), "whitespace-nowrap")}
            >
              {s.labelAr}
            </span>
          </span>
        ))}
      </div>

      {/* الأطراف — من ينتظر من */}
      <div className="flex flex-wrap items-center gap-2">
        {state.parties.map((p) => (
          <span
            key={p.key}
            className="rounded-[8px] border border-border bg-surface-2 px-2 py-[3px] text-[11px] text-text"
          >
            <strong>{p.labelAr}</strong>: {p.statusLabelAr}
            {p.waitingOnLabelsAr.length > 0 ? (
              <span className="text-text-3">
                {" "}
                — ينتظر {p.waitingOnLabelsAr.join(" و")}
              </span>
            ) : null}
          </span>
        ))}
      </div>

      {state.waitingSummaryAr ? (
        <p className="m-0 mt-2 text-[11px] text-text-3">{state.waitingSummaryAr}</p>
      ) : null}
    </div>
  );
}
