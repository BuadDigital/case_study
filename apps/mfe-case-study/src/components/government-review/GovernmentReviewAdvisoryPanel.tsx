"use client";

import { useEffect, useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  Button,
  InlineLoadingSkeleton,
  Label,
  cn,
  formControlClassName,
} from "@platform/design-system";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { findGovernmentReviewChildForParent } from "../../lib/government-review-task";
import {
  GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
  fetchGovernmentReviewSubmission,
  reopenGovernmentReviewSubmission,
} from "../../lib/prototype/government-review-work-storage";
import {
  formatGovernmentReviewKeysProofLabel,
  governmentReviewKeysStatusLabel,
  governmentReviewStatusLabel,
  governmentReviewVisitStatusLabel,
  type GovernmentReviewSubmission,
} from "../../lib/prototype/government-review-work-data";
import { PartyRecallAdvisorySection } from "../party-tasks/PartyRecallAdvisorySection";

const noteWarnClass =
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text";

const infoRowClass =
  "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

export function GovernmentReviewAdvisoryPanel({
  parentTask,
  propertyId,
  tasks,
  onReturned,
}: {
  parentTask: WorkflowTask;
  propertyId: string;
  tasks: WorkflowTask[];
  onReturned?: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<GovernmentReviewSubmission | null>(
    null,
  );
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(
        GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
      window.removeEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    };
  }, []);

  const reviewTask = useMemo(
    () => findGovernmentReviewChildForParent(parentTask.id, propertyId, tasks),
    [parentTask.id, propertyId, tasks, refreshKey],
  );

  useEffect(() => {
    if (!reviewTask) {
      setSubmission(null);
      return;
    }
    let cancelled = false;
    setLoadingSubmission(true);
    void fetchGovernmentReviewSubmission(reviewTask.id).then((loaded) => {
      if (!cancelled) {
        setSubmission(loaded);
        setLoadingSubmission(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reviewTask, refreshKey]);

  if (!reviewTask) {
    return (
      <RegistrationFormCard title="المراجعة الحكومية (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          لم تُسند مهمة المراجعة الحكومية بعد لهذا العقار.
        </p>
      </RegistrationFormCard>
    );
  }

  if (loadingSubmission) {
    return (
      <RegistrationFormCard title="المراجعة الحكومية (استرشادي)">
        <InlineLoadingSkeleton />
      </RegistrationFormCard>
    );
  }

  if (!submission || submission.status === "draft") {
    return (
      <RegistrationFormCard title="المراجعة الحكومية (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          المراجع لم يُرسل نتيجة المراجعة بعد.
        </p>
      </RegistrationFormCard>
    );
  }

  async function handleReturnForCorrection() {
    if (!reviewTask) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    const reopened = await reopenGovernmentReviewSubmission(
      reviewTask.id,
      trimmed,
    );
    if (!reopened) {
      setReturnError("تعذّر إعادة المراجعة للتصحيح — حاول لاحقاً");
      return;
    }
    setSubmission(reopened);
    setReturnOpen(false);
    setReturnNote("");
    setReturnError(null);
    setRefreshKey((k) => k + 1);
    onReturned?.();
  }

  const keysProofLabel = formatGovernmentReviewKeysProofLabel(
    submission.keysProofFiles,
  );

  return (
    <RegistrationFormCard title="المراجعة الحكومية (استرشادي — للقراءة فقط)">
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        ملخص من المراجع الحكومي — يمكنك إعادة المهمة للتصحيح أو الموافقة على طلب
        الاسترجاع.
      </p>

      <PartyRecallAdvisorySection
        taskId={reviewTask.id}
        partyLabel="المراجع الحكومي"
        refreshKey={refreshKey}
        onResolved={() => {
          setRefreshKey((k) => k + 1);
          onReturned?.();
        }}
      />

      {submission.status === "reopened" && submission.returnNote?.trim() ? (
        <div className={noteWarnClass}>
          <p className="m-0">
            <strong>مُعاد للتصحيح</strong> — {submission.returnNote.trim()}
          </p>
        </div>
      ) : null}

      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">الحالة</span>
        <span className="text-left font-medium text-text">
          {governmentReviewStatusLabel(submission.status)}
        </span>
      </div>
      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">حالة الزيارة</span>
        <span className="text-left font-medium text-text">
          {governmentReviewVisitStatusLabel(submission.visitStatus)}
        </span>
      </div>
      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">المفاتيح</span>
        <span className="text-left font-medium text-text">
          {governmentReviewKeysStatusLabel(submission.keysStatus)}
        </span>
      </div>
      {keysProofLabel ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">إثبات المفاتيح</span>
          <span className="text-left font-medium text-text">{keysProofLabel}</span>
        </div>
      ) : null}

      {submission.status === "submitted" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!returnOpen ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              إعادة للتصحيح
            </Button>
          ) : (
            <div className="w-full">
              <Label htmlFor="gov-return-note" className="text-xs">
                سبب الإرجاع للتصحيح{" "}
                <span className="text-danger-text">*</span>
              </Label>
              <textarea
                id="gov-return-note"
                className={cn(
                  formControlClassName,
                  "mt-1 min-h-[72px] resize-y py-2 text-xs leading-relaxed",
                )}
                rows={3}
                value={returnNote}
                placeholder="اذكر ما يجب على المراجع تصحيحه…"
                onChange={(e) => {
                  setReturnNote(e.target.value);
                  if (returnError) setReturnError(null);
                }}
              />
              {returnError ? (
                <p className="mt-1.5 text-[11px] text-danger-text">{returnError}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void handleReturnForCorrection()}
                >
                  تأكيد الإرجاع
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReturnOpen(false);
                    setReturnError(null);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </RegistrationFormCard>
  );
}
