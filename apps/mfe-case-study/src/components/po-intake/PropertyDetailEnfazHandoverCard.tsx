"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TransactionStateDto } from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import {
  Button,
  Note,
  cn,
  opsPanelCard,
  useToast,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  canHandOverToEnfaz,
  canReopenTransaction,
} from "../../lib/app-data/po-roles";
import {
  confirmEnfazHandover,
} from "../../lib/app-data/enfaz-handover-commands";
import {
  enfazCardState,
  enfazStageShortStatus,
  enfazStageTone,
} from "../../lib/app-data/enfaz-handover-state";
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import {
  transactionStateQueryKey,
  useTransactionStateQuery,
} from "../../query/use-transaction-state-query";
import { useConfirmActionDialog } from "../ConfirmActionDialog";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";
import { TransactionReopenDialog } from "./TransactionReopenDialog";

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
  const { role, access } = useAppAccess();
  const canHandOver = canHandOverToEnfaz(access);
  // Omar 2026-11-05: any specialist reopens (after the deposit or the upload); coordination replies to Enfaz.
  const canReturn = canReopenTransaction(access);
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

  const reopening = state?.reopening ?? null;

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

          {reopening ? (
            <Note tone="info" data-testid="transaction-reopening">
              المعاملة معادة للدراسة
              {" — "}
              {reopening.sourceLabelAr}
              {reopening.enfazReference ? ` (${reopening.enfazReference})` : ""}
              {`: ${reopening.reason} · يتأثر: ${reopening.affectedLabelAr}`}
              {reopening.openedByName ? ` · فتحها ${reopening.openedByName}` : ""}
            </Note>
          ) : null}

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
              {/* A deed the accountant marked ready for billing is not taken back: its figures are on Enfaz. */}
              {card.billingReady ? (
                <Note tone="info">
                  وُسم الصك «جاهز للفوترة» — ظهرت بياناته المالية على إنفاذ، فلا يُسترجع للتعديل.
                </Note>
              ) : canReturn && state.canReopen !== false ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  showActionToast={false}
                  onClick={() => setReturnOpen(true)}
                >
                  إعادة فتح المعاملة
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
              {/* Omar 2026-11-08: the upload follows «تجهيز المعاملة للرفع» (the package check). */}
              {canHandOver && card.blockReasons.length === 0 ? (
                <Note tone={card.readyForUpload ? "success" : "info"} data-testid="upload-prep-state">
                  {card.readyForUpload
                    ? "جُهّزت المعاملة للرفع — هي في صفوف الرفع."
                    : "جهّز المعاملة للرفع أولاً من «حزمة الرفع» — يتحقق النظام من المرفقات قبل نقلها لصفوف الرفع."}
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
              {/* Deposited, not uploaded yet: a mistake found now is corrected by reopening too. */}
              {canReturn && state.canReopen ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  showActionToast={false}
                  onClick={() => setReturnOpen(true)}
                >
                  إعادة فتح المعاملة
                </Button>
              ) : null}
            </>
          )}
        </div>
      )}

      {confirmDialog}
      {returnOpen ? (
        <TransactionReopenDialog
          workOrderId={workOrderId}
          propertyId={propertyId}
          onClose={() => setReturnOpen(false)}
          onReopened={(next) => {
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
