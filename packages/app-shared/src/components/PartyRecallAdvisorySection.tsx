"use client";

import { useEffect, useState } from "react";
import { AppModal, Button, Label, Textarea, useToast } from "@platform/ui-kit";
import {
  PARTY_TASK_RECALL_CHANGED_EVENT,
  PARTY_TASK_RECALL_HYDRATED_EVENT,
  getPartyTaskRecall,
  partyTaskRecallStatusLabel,
} from "@platform/app-shared/app-data/party-task-recall-model";
import {
  approvePartyTaskRecall,
  rejectPartyTaskRecall,
} from "@platform/app-shared/app-data/party-task-recall-commands";
import { hydratePartyTaskRecallForTask } from "@platform/app-shared/app-data/party-task-recall-reads";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";

const noteWarnClass =
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text";

const infoRowClass =
  "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

/**
 * A party's recall request on one task. Only the case specialist decides (`canDecide` — the
 * caller passes `canDecideAppraisalRecall(role)`); everyone else sees the request and its status.
 * Approve is one server call that reopens the party's package; reject takes an optional note in
 * a small dialog. A failed decision leaves the request pending, so the same button retries it.
 */
export function PartyRecallAdvisorySection({
  taskId,
  partyLabel,
  refreshKey,
  canDecide = false,
  onResolved,
}: {
  taskId: string;
  partyLabel: string;
  refreshKey: number;
  /** Show the approve / reject controls (the specialist only). */
  canDecide?: boolean;
  onResolved?: () => void;
}) {
  const { showToast } = useToast();
  const [, setTick] = useState(0);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const rerender = () => setTick((n) => n + 1);
  useWindowEvents({
    [PARTY_TASK_RECALL_CHANGED_EVENT]: rerender,
    [PARTY_TASK_RECALL_HYDRATED_EVENT]: rerender,
  });

  // The specialist opens the property long after the appraiser asked — read the row itself.
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    void hydratePartyTaskRecallForTask(taskId).then(() => {
      if (!cancelled) rerender();
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey]);

  const recall = getPartyTaskRecall(taskId);
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
        result.error || "تعذّرت الموافقة على الاسترجاع — حاول لاحقاً",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    setBusyAction("reject");
    try {
      const result = await rejectPartyTaskRecall(taskId, rejectNote);
      if (result.ok) {
        setRejectOpen(false);
        setRejectNote("");
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

  if (recall.status === "pending") {
    return (
      <div className={noteWarnClass}>
        <p className="m-0">
          <strong>طلب استرجاع من {partyLabel}</strong>
          {recall.reason ? ` — ${recall.reason}` : ""}
        </p>
        {canDecide ? (
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
              disabled={busyAction !== null}
              showActionToast={false}
              onClick={() => setRejectOpen(true)}
            >
              رفض
            </Button>
          </div>
        ) : (
          <p className="mb-0 mt-1.5 text-[11px] text-text-2">
            {partyTaskRecallStatusLabel("pending")}
          </p>
        )}
        {rejectOpen ? (
          <AppModal
            open
            title="رفض طلب الاسترجاع"
            subtitle={`سيبقى عمل ${partyLabel} مغلقاً كما هو، ويُبلَّغ بقرارك.`}
            onClose={() => {
              if (busyAction === null) setRejectOpen(false);
            }}
            maxWidthPx={440}
            look="ops-html"
            footer={
              <div className="flex w-full justify-end gap-2.5">
                <Button
                  variant="default"
                  showActionToast={false}
                  disabled={busyAction !== null}
                  onClick={() => setRejectOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  showActionToast={false}
                  loading={busyAction === "reject"}
                  onClick={() => void handleReject()}
                >
                  تأكيد الرفض
                </Button>
              </div>
            }
          >
            <Label
              htmlFor={`recall-reject-note-${taskId}`}
              className="mb-1.5 text-[11px] font-semibold text-text-2"
            >
              سبب الرفض (اختياري)
            </Label>
            <Textarea
              id={`recall-reject-note-${taskId}`}
              rows={3}
              value={rejectNote}
              className="rounded-[10px] border-border-md bg-surface"
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </AppModal>
        ) : null}
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
