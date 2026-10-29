"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Note, promptAction, useToast } from "@platform/ui-kit";
import {
  decideTransactionCancellation,
  type TransactionCancellationDto,
} from "@platform/api-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  mutationFromApiResult,
  requireWorkOrdersApiConfig,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { formatDateAr } from "@platform/app-shared/format/date";
import { canDecideTransactionCancel } from "../../lib/app-data/po-roles";
import {
  invalidateAfterTransactionCancellation,
  useTransactionCancellationQuery,
} from "../../query/use-transaction-cancellation-query";

type Action = "approve" | "reject" | "reactivate";

/** The prompt each supervisor action asks; reactivation needs a reason, the decisions do not. */
const ACTION_PROMPTS: Record<Action, { title: string; label: string; confirm: string; required: boolean; done: string }> = {
  approve: { title: "اعتماد إلغاء المعاملة", label: "ملاحظة (اختيارية)", confirm: "اعتماد الإلغاء", required: false, done: "أُلغيت المعاملة" },
  reject: { title: "رفض طلب الإلغاء", label: "سبب الرفض (اختياري)", confirm: "رفض الطلب", required: false, done: "رُفض طلب الإلغاء" },
  reactivate: { title: "إعادة تفعيل المعاملة", label: "سبب إعادة التفعيل", confirm: "إعادة التفعيل", required: true, done: "أُعيد تفعيل المعاملة" },
};

/**
 * «إلغاء المعاملة» on the property page: a pending request (the supervisor approves or rejects it
 * here) or the approved cancellation (who, when, why — and the supervisor's «إعادة تفعيل»).
 *
 * How it works: reads the deed's cancellation state; renders nothing when there is neither. Each
 * supervisor action asks its note in the shared prompt, posts it, refreshes every app-data query and
 * toasts the outcome.
 *
 * Edge cases: a work-order request lists how many deeds it covers; the buttons stay hidden for every
 * role but the supervisor and the CDO (the server refuses the others anyway); a server refusal
 * (decided meanwhile) is toasted and the state refetched.
 */
export function TransactionCancellationBanner({ propertyId }: { propertyId: string }) {
  const { role } = useAppAccess();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data } = useTransactionCancellationQuery(propertyId);
  const [busy, setBusy] = useState<Action | null>(null);
  const decides = canDecideTransactionCancel(role);

  const pending = data?.pending ?? null;
  const cancelled = data?.cancelled ?? null;
  if (!pending && !cancelled) return null;

  async function act(request: TransactionCancellationDto, action: Action) {
    const prompt = ACTION_PROMPTS[action];
    const note = await promptAction({
      title: prompt.title,
      label: prompt.label,
      required: prompt.required,
      confirmLabel: prompt.confirm,
      danger: action !== "reactivate",
    });
    if (note === null) return;
    setBusy(action);
    try {
      const result = mutationFromApiResult(
        await decideTransactionCancellation(requireWorkOrdersApiConfig(), request.id, action, note.trim()),
        "تعذّر تنفيذ الإجراء",
      );
      await invalidateAfterTransactionCancellation(queryClient);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(prompt.done, "success");
    } finally {
      setBusy(null);
    }
  }

  if (cancelled) {
    return (
      <Note tone="danger" role="status" className="mb-4">
        <strong>المعاملة ملغاة</strong> — {cancelled.reasonLabel}
        {cancelled.note ? `: ${cancelled.note}` : ""}
        <span className="block text-[12px]">
          طلبها {cancelled.requestedByName || "—"}، واعتمدها {cancelled.decidedByName || "—"}
          {cancelled.decidedAtUtc ? ` في ${formatDateAr(cancelled.decidedAtUtc)}` : ""}
          {cancelled.decisionNote ? ` — ${cancelled.decisionNote}` : ""}
        </span>
        {decides ? (
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              loading={busy === "reactivate"}
              disabled={busy !== null}
              showActionToast={false}
              onClick={() => void act(cancelled, "reactivate")}
            >
              إعادة تفعيل المعاملة
            </Button>
          </div>
        ) : null}
      </Note>
    );
  }

  const request = pending!;
  return (
    <Note tone="warn" role="status" className="mb-4">
      <strong>طلب إلغاء بانتظار المشرف</strong> — {request.reasonLabel}
      {request.note ? `: ${request.note}` : ""}
      <span className="block text-[12px]">
        طلبه {request.requestedByName || "—"} في {formatDateAr(request.requestedAtUtc)}
        {request.deeds.length > 1 ? ` — يشمل ${request.deeds.length} صكوك` : ""}
      </span>
      {decides ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="danger"
            loading={busy === "approve"}
            disabled={busy !== null}
            showActionToast={false}
            onClick={() => void act(request, "approve")}
          >
            اعتماد الإلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            loading={busy === "reject"}
            disabled={busy !== null}
            showActionToast={false}
            onClick={() => void act(request, "reject")}
          >
            رفض الطلب
          </Button>
        </div>
      ) : null}
    </Note>
  );
}
