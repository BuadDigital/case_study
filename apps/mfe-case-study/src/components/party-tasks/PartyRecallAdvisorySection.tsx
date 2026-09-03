"use client";

import { useState } from "react";
import { Button, useToast } from "@platform/ui-kit";
import {
  getPartyTaskRecall,
  partyTaskRecallStatusLabel,
} from "@platform/app-shared/app-data/party-task-recall-model";
import {
  approvePartyTaskRecall,
  rejectPartyTaskRecall,
} from "@platform/app-shared/app-data/party-task-recall-commands";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";

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
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(
    null,
  );

  if (!recall) return null;

  async function handleApprove() {
    setBusyAction("approve");
    try {
      const result = await approvePartyTaskRecall(taskId);
      if (result.ok) {
        showToast("تمت الموافقة على طلب الاسترجاع", "success");
        onResolved?.();
        return;
      }
      showToast(
        result.error || "تعذّر الموافقة على الاسترجاع — حاول لاحقاً",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    const note = window.prompt("سبب الرفض (اختياري):", "");
    if (note === null) return;
    setBusyAction("reject");
    try {
      const result = await rejectPartyTaskRecall(taskId, note);
      if (result.ok) {
        showToast("تم رفض طلب الاسترجاع", "success");
        onResolved?.();
        return;
      }
      showToast(
        result.error || "تعذّر رفض طلب الاسترجاع — حاول لاحقاً",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
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
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={busyAction === "approve"}
            disabled={busyAction !== null}
            showActionToast={false}
            onClick={() => void handleApprove()}
          >
            الموافقة على الاسترجاع
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busyAction === "reject"}
            disabled={busyAction !== null}
            showActionToast={false}
            onClick={() => void handleReject()}
          >
            رفض
          </Button>
        </div>
      </div>
    );
  }

  // Approve and reopen are separate calls, so an approved recall can leave the
  // work still submitted. Offer the retry instead of a dead status row.
  if (
    recall.status === "approved" &&
    getCachedPartySubmission(taskId)?.status === "submitted"
  ) {
    return (
      <div className={noteWarnClass}>
        <p className="m-0">
          <strong>وُوفّق على الاسترجاع لكن العمل ما زال مغلقاً على {partyLabel}</strong>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={busyAction === "approve"}
            showActionToast={false}
            onClick={() => void handleApprove()}
          >
            إعادة فتح العمل للطرف
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
