"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TransactionStateDto } from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import {
  AppModal,
  Button,
  Label,
  Note,
  Textarea,
  cn,
  opsPanelCard,
  useToast,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  canHandOverToEnfaz,
  canReturnFromEnfaz,
} from "../../lib/app-data/po-roles";
import {
  confirmEnfazHandover,
  returnPropertyFromEnfaz,
} from "../../lib/app-data/enfaz-handover-commands";
import {
  ENFAZ_RETURN_REASON_MIN_LENGTH,
  enfazCardState,
  enfazStageShortStatus,
  enfazStageTone,
  planEnfazReturn,
} from "../../lib/app-data/enfaz-handover-state";
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import {
  transactionStateQueryKey,
  useTransactionStateQuery,
} from "../../query/use-transaction-state-query";
import { useConfirmActionDialog } from "../ConfirmActionDialog";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";

/**
 * «التسليم على إنفاذ» — the case specialist's card on the property detail rail. Shows the stage
 * grid, what blocks the upload, the confirm button (live only when nothing blocks) and, once handed
 * over, «إعادة من إنفاذ». Nothing renders for any other role.
 */
export function PropertyDetailEnfazHandoverCard({
  workOrderId,
  propertyId,
}: {
  workOrderId: string;
  propertyId: string;
}) {
  const { role } = useAppAccess();
  const canHandOver = canHandOverToEnfaz(role);
  const canReturn = canReturnFromEnfaz(role);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmActionDialog();
  const [busy, setBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const query = useTransactionStateQuery(workOrderId, propertyId, {
    enabled: canHandOver || canReturn,
  });
  const refetch = () => void query.refetch();

  if (!canHandOver && !canReturn) return null;

  const state = query.data;
  const card = enfazCardState(state);

  async function handleConfirmHandover() {
    if (busy || !card.canConfirmHandover) return;
    const ok = await confirm({
      title: "تسجيل الرفع على إنفاذ",
      message:
        "سيُسجَّل رفع هذه المعاملة على إنفاذ ويُختم تاريخ التسليم. لا يُعاد فتح التقرير بعدها إلا بإلغاء ختم التسليم.",
      confirmLabel: "تسجيل الرفع",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await confirmEnfazHandover(workOrderId, propertyId);
      if (!result.ok) {
        showToast(result.error, "error");
        refetch();
        return;
      }
      queryClient.setQueryData(
        transactionStateQueryKey(workOrderId, propertyId),
        result.data,
      );
      showToast("سُجّل رفع المعاملة على إنفاذ", "success");
      notifyTasksChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(opsPanelCard, "px-4 py-3.5")} data-testid="enfaz-handover-card">
      <div className="mb-3 text-[12.5px] font-bold text-heading">التسليم على إنفاذ</div>

      {query.isLoading ? (
        <p className="m-0 text-xs text-text-3">جارٍ تحميل حالة المعاملة…</p>
      ) : query.isError || !state ? (
        <Note tone="warn">
          تعذّر تحميل حالة المعاملة.{" "}
          <button type="button" className="font-bold underline" onClick={refetch}>
            إعادة المحاولة
          </button>
        </Note>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {state.stages.map((stage) => (
              <li
                key={stage.key}
                className="flex min-w-0 items-start justify-between gap-2 text-[11.5px]"
                title={`${stage.labelAr} — ${stage.statusLabelAr}`}
              >
                <span className="min-w-0 flex-1 leading-[1.65] text-text-2">
                  {stage.labelAr}
                </span>
                <DetailBadge
                  tone={enfazStageTone(stage.status)}
                  className="mt-px w-[62px] shrink-0 justify-center px-1 py-px text-[10px]"
                >
                  {enfazStageShortStatus(stage.status, stage.statusLabelAr)}
                </DetailBadge>
              </li>
            ))}
          </ul>

          {card.handedOver ? (
            <>
              <Note tone="success">
                سُلِّمت المعاملة على إنفاذ
                {card.handedOverAtUtc ? (
                  <>
                    {" "}بتاريخ{" "}
                    <bdi dir="ltr" className={ltrValueClass}>
                      {formatDateAr(card.handedOverAtUtc.slice(0, 10))}
                    </bdi>
                  </>
                ) : null}
                .
              </Note>
              {canReturn ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  showActionToast={false}
                  onClick={() => setReturnOpen(true)}
                >
                  إعادة من إنفاذ
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {card.blockReasons.length > 0 ? (
                <Note tone="warn">
                  <ul className="m-0 list-disc ps-4">
                    {card.blockReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </Note>
              ) : null}
              {canHandOver ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  loading={busy}
                  disabled={!card.canConfirmHandover}
                  showActionToast={false}
                  onClick={() => void handleConfirmHandover()}
                >
                  تسجيل الرفع على إنفاذ
                </Button>
              ) : null}
            </>
          )}
        </div>
      )}

      {confirmDialog}
      {returnOpen ? (
        <EnfazReturnDialog
          workOrderId={workOrderId}
          propertyId={propertyId}
          onClose={() => setReturnOpen(false)}
          onReturned={(next) => {
            queryClient.setQueryData(
              transactionStateQueryKey(workOrderId, propertyId),
              next,
            );
            notifyTasksChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function EnfazReturnDialog({
  workOrderId,
  propertyId,
  onClose,
  onReturned,
}: {
  workOrderId: string;
  propertyId: string;
  onClose: () => void;
  onReturned: (state: TransactionStateDto) => void;
}) {
  const [reason, setReason] = useState("");
  const [reopenStudy, setReopenStudy] = useState(false);
  const [reopenValuation, setReopenValuation] = useState(false);
  const [error, setError] = useState<{ field: "reason" | "choice" | "server"; text: string } | null>(null);
  const [notices, setNotices] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const plan = planEnfazReturn({ reason, reopenStudy, reopenValuation });
    if (!plan.ok) {
      setError({ field: plan.field, text: plan.error });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await returnPropertyFromEnfaz(workOrderId, propertyId, plan.request);
      if (!result.ok) {
        setError({ field: "server", text: result.error });
        return;
      }
      onReturned(result.data);
      if (result.data.enfazReturnNoticesAr.length > 0) {
        setNotices(result.data.enfazReturnNoticesAr);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (notices) {
    return (
      <AppModal
        open
        title="أُعيدت المعاملة من إنفاذ"
        onClose={onClose}
        maxWidthPx={470}
        look="ops-html"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="primary" showActionToast={false} onClick={onClose}>
              تم
            </Button>
          </div>
        }
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] leading-relaxed text-heading">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </AppModal>
    );
  }

  return (
    <AppModal
      open
      title="إعادة من إنفاذ"
      subtitle="يُلغى ختم التسليم على إنفاذ ويُسجَّل في سجل التدقيق والجدول الزمني."
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidthPx={470}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button variant="default" showActionToast={false} disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            showActionToast={false}
            loading={busy}
            onClick={() => void submit()}
          >
            تأكيد الإعادة
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label
            htmlFor="enfaz-return-reason"
            className="mb-1.5 text-[11px] font-semibold text-text-2"
          >
            سبب الإعادة ({ENFAZ_RETURN_REASON_MIN_LENGTH} أحرف على الأقل){" "}
            <span className="text-danger-text">*</span>
          </Label>
          <Textarea
            id="enfaz-return-reason"
            rows={3}
            value={reason}
            aria-invalid={error?.field === "reason" ? true : undefined}
            className={cn(
              "rounded-[10px] border-border-md bg-surface",
              error?.field === "reason" && invalidControlClass,
            )}
            onChange={(e) => {
              setReason(e.target.value);
              if (error?.field === "reason") setError(null);
            }}
          />
          {error?.field === "reason" ? (
            <Note tone="danger" className="mt-2">
              {error.text}
            </Note>
          ) : null}
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-[11px] font-semibold text-text-2">
            ما الذي يُعاد؟
          </legend>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-heading">
            <input
              type="checkbox"
              checked={reopenStudy}
              disabled={busy}
              onChange={(e) => {
                setReopenStudy(e.target.checked);
                if (error?.field === "choice") setError(null);
              }}
            />
            <span>إعادة فتح تقرير الدراسة</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-heading">
            <input
              type="checkbox"
              checked={reopenValuation}
              disabled={busy}
              onChange={(e) => {
                setReopenValuation(e.target.checked);
                if (error?.field === "choice") setError(null);
              }}
            />
            <span>إعادة التقييم</span>
          </label>
          {error?.field === "choice" ? <Note tone="danger">{error.text}</Note> : null}
        </fieldset>

        {error?.field === "server" ? <Note tone="warn">{error.text}</Note> : null}
      </div>
    </AppModal>
  );
}
