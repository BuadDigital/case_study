"use client";

import { Button, useToast } from "@platform/design-system";
import {
  approvePartyTaskRecall,
  getPartyTaskRecall,
  partyTaskRecallStatusLabel,
  rejectPartyTaskRecall,
} from "@platform/app-shared/prototype/party-task-recall-storage";

const noteWarnClass =
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text";

const infoRowClass =
  "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

export function PartyRecallAdvisorySection({
  taskId,
  partyLabel,
  refreshKey,
  onResolved,
}: {
  taskId: string;
  partyLabel: string;
  refreshKey: number;
  onResolved?: () => void;
}) {
  const { showToast } = useToast();
  const recall = getPartyTaskRecall(taskId);

  if (!recall) return null;

  function handleApprove() {
    void approvePartyTaskRecall(taskId).then((result) => {
      if (result) {
        showToast("تمت الموافقة على طلب الاسترجاع", "success");
        onResolved?.();
        return;
      }
      showToast("تعذّر الموافقة على الاسترجاع — حاول لاحقاً", "error");
    });
  }

  function handleReject() {
    const note = window.prompt("سبب الرفض (اختياري):", "");
    if (note === null) return;
    void rejectPartyTaskRecall(taskId, note).then((result) => {
      if (result) {
        showToast("تم رفض طلب الاسترجاع", "success");
        onResolved?.();
        return;
      }
      showToast("تعذّر رفض طلب الاسترجاع — حاول لاحقاً", "error");
    });
  }

  void refreshKey;

  if (recall.status === "pending") {
    return (
      <div className={noteWarnClass}>
        <p className="m-0">
          <strong>طلب استرجاع من {partyLabel}</strong>
          {recall.reason ? ` — ${recall.reason}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="primary" onClick={handleApprove}>
            الموافقة على الاسترجاع
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleReject}>
            رفض
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={infoRowClass}>
      <span className="shrink-0 text-text-3">طلب الاسترجاع</span>
      <span className="text-left font-medium text-text">
        {partyTaskRecallStatusLabel(recall.status)}
      </span>
    </div>
  );
}
