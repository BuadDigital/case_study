"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTransactionExternalReceipt,
  closeTransactionExternalReceipt,
  listTransactionExternalReceipts,
  type TransactionExternalReceiptDto,
} from "@platform/api-client";
import { Badge, Button, Input, Label, Note, useToast, type BadgeTone } from "@platform/ui-kit";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { formatDateAr } from "../../lib/app-data/po-intake-data";

const STATUS_TEXT: Record<TransactionExternalReceiptDto["status"], string> = {
  pending: "بانتظار الاستلام",
  received: "استُلم",
  cancelled: "أُلغي الانتظار",
};
const STATUS_TONE: Record<TransactionExternalReceiptDto["status"], BadgeTone> = {
  pending: "warning",
  received: "success",
  cancelled: "default",
};

export function externalReceiptsQueryKey(propertyId: string) {
  return ["transaction-external-receipts", propertyId] as const;
}

/**
 * «الأطراف الخارجية» on the coordinator's page (Omar 2026-11-08): the deliveries the transaction waits
 * for from outside the system.
 *
 * How it works: lists them (who, what, its state); the coordinator adds one («إضافة استلام من طرف
 * خارجي»), then marks it «تم الاستلام» when it arrives or drops it. A pending one keeps the transaction
 * «بانتظار طرف خارجي» and the server refuses «إرسال المعاملة للدراسة» until it is closed. Each change
 * refreshes the list and the task list (its «بانتظار» flag).
 * Edge cases: once the transaction is sent (`sent`) or for a viewer without the step (`canManage`
 * false) the list is read-only; a refusal from the server shows as a toast.
 */
export function ExternalReceiptsSection({
  propertyId,
  canManage,
  sent,
}: {
  propertyId: string;
  canManage: boolean;
  sent: boolean;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [partyName, setPartyName] = useState("");
  const [awaited, setAwaited] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: externalReceiptsQueryKey(propertyId),
    queryFn: async () =>
      unwrapApiResult(
        await listTransactionExternalReceipts(requireWorkOrdersApiConfig(), propertyId),
        "تعذّر تحميل الأطراف الخارجية",
      ),
  });
  const rows = query.data ?? [];
  const editable = canManage && !sent;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: externalReceiptsQueryKey(propertyId) });
    void queryClient.invalidateQueries({ queryKey: appDataKeys.workflowTasks() });
  };

  async function add() {
    setBusy("add");
    try {
      const result = await addTransactionExternalReceipt(requireWorkOrdersApiConfig(), propertyId, {
        partyName,
        awaited,
      });
      if (!result.ok) {
        showToast(("message" in result && result.message) || "تعذّرت الإضافة", "error");
        return;
      }
      setPartyName("");
      setAwaited("");
      showToast("أُضيف الطرف الخارجي — المعاملة بانتظاره", "success");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function close(row: TransactionExternalReceiptDto, outcome: "received" | "cancel") {
    setBusy(row.id);
    try {
      const result = await closeTransactionExternalReceipt(requireWorkOrdersApiConfig(), row.id, outcome);
      if (!result.ok) {
        showToast(("message" in result && result.message) || "تعذّر الحفظ", "error");
        return;
      }
      showToast(outcome === "received" ? "سُجّل الاستلام" : "أُلغي الانتظار", "success");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3" data-testid="coordination-external-receipts">
      <p className="m-0 text-[12.5px] text-text-2">
        طرف من خارج النظام ننتظر منه شيئًا (مكتب، جهة، شخص). ما دام بانتظار الاستلام لا تُرسل المعاملة للدراسة.
      </p>
      {query.isError ? <Note tone="warn">تعذّر تحميل الأطراف الخارجية.</Note> : null}
      {rows.length === 0 && query.isFetched ? (
        <p className="m-0 text-[12px] text-text-3">لا يوجد طرف خارجي على هذه المعاملة.</p>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"
        >
          <span className="font-bold text-heading">{row.partyName}</span>
          <span className="text-text-2">— {row.awaited}</span>
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_TEXT[row.status]}</Badge>
          <span className="flex-1" />
          <span className="text-[11.5px] text-text-3">
            {row.status === "received" && row.receivedAtUtc
              ? `${row.receivedByName ?? ""} · ${formatDateAr(row.receivedAtUtc)}`
              : `${row.createdByName ?? ""} · ${formatDateAr(row.createdAtUtc)}`}
          </span>
          {editable && row.status === "pending" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={busy === row.id}
                disabled={busy !== null}
                onClick={() => void close(row, "received")}
              >
                تم الاستلام
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void close(row, "cancel")}
              >
                إلغاء الانتظار
              </Button>
            </>
          ) : null}
        </div>
      ))}
      {editable ? (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border-md p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ext-party-${propertyId}`}>الطرف الخارجي</Label>
            <Input
              id={`ext-party-${propertyId}`}
              value={partyName}
              maxLength={200}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="مثال: مكتب مساحي خارجي"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ext-awaited-${propertyId}`}>ما ننتظره منه</Label>
            <Input
              id={`ext-awaited-${propertyId}`}
              value={awaited}
              maxLength={500}
              onChange={(e) => setAwaited(e.target.value)}
              placeholder="مثال: كروكي معتمد"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy === "add"}
            disabled={busy !== null || !partyName.trim() || !awaited.trim()}
            onClick={() => void add()}
          >
            إضافة استلام من طرف خارجي
          </Button>
        </div>
      ) : null}
    </div>
  );
}
