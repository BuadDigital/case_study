"use client";

import { useEffect, useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Button, cn } from "@platform/design-system";
import type { WorkflowTask } from "@case-study/mfe";
import { findAppraisalChildForParent } from "../../lib/evaluator/evaluator-inspection-gate";
import { openEvaluatorReportPreview } from "../../lib/evaluator/evaluator-report-attachments";
import {
  approveEvaluatorRecall,
  EVALUATOR_RECALL_CHANGED_EVENT,
  getEvaluatorRecall,
  hydrateEvaluatorRecallForTask,
  recallStatusLabel,
  rejectEvaluatorRecall,
} from "../../lib/evaluator/evaluator-recall-storage";
import {
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  fetchEvaluatorSubmissionSnapshot,
  loadEvaluatorSubmission,
} from "../../lib/evaluator/evaluator-submission-storage";
import {
  checklistAnswerLabel,
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
  evaluatorStatusLabel,
  formatEvaluatorPriceDisplay,
} from "../../lib/evaluator/evaluator-window-data";

const noteWarnClass = cn(
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text",
);

const infoRowClass =
  "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

export function EvaluatorAdvisoryPanel({
  parentTask,
  propertyId,
  tasks,
  onReopened,
}: {
  parentTask: WorkflowTask;
  propertyId: string;
  tasks: WorkflowTask[];
  onReopened?: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const appraisalTask = useMemo(
    () => findAppraisalChildForParent(parentTask.id, propertyId, tasks),
    [parentTask.id, propertyId, tasks, refreshKey],
  );

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(EVALUATOR_RECALL_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
      window.removeEventListener(EVALUATOR_RECALL_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!appraisalTask) return;
    void hydrateEvaluatorRecallForTask(appraisalTask.id).then(() => {
      setRefreshKey((k) => k + 1);
    });
  }, [appraisalTask?.id]);

  useEffect(() => {
    if (!appraisalTask) return;
    void fetchEvaluatorSubmissionSnapshot(appraisalTask.id).then(() => {
      setRefreshKey((k) => k + 1);
    });
  }, [appraisalTask?.id]);

  const submission = useMemo(() => {
    if (!appraisalTask) return null;
    return loadEvaluatorSubmission(appraisalTask.id);
  }, [appraisalTask, refreshKey]);

  const recall = useMemo(() => {
    if (!appraisalTask) return null;
    return getEvaluatorRecall(appraisalTask.id);
  }, [appraisalTask, refreshKey]);

  if (!appraisalTask) {
    return (
      <RegistrationFormCard title="بيانات المقيم العقاري (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          لم تُسند مهمة التقييم العقاري بعد لهذا العقار.
        </p>
      </RegistrationFormCard>
    );
  }

  if (!submission || submission.status === "draft") {
    return (
      <RegistrationFormCard title="بيانات المقيم العقاري (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          المقيم لم يُرسل التقييم بعد — القيمة التقديرية تُحدَّد من المقيم فقط.
        </p>
      </RegistrationFormCard>
    );
  }

  function handleApproveRecall() {
    if (!appraisalTask) return;
    void approveEvaluatorRecall(appraisalTask.id).then(() => {
      setRefreshKey((k) => k + 1);
      onReopened?.();
    });
  }

  function handleRejectRecall() {
    if (!appraisalTask) return;
    const note = window.prompt("سبب الرفض (اختياري):", "");
    if (note === null) return;
    void rejectEvaluatorRecall(appraisalTask.id, note).then(() => {
      setRefreshKey((k) => k + 1);
    });
  }

  const allQuestions = [
    ...EVALUATOR_SIMPLE_QUESTIONS,
    ...EVALUATOR_CONDITIONAL_QUESTIONS,
  ];

  return (
    <RegistrationFormCard title="بيانات المقيم العقاري (استرشادي — للقراءة فقط)">
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        هذه البيانات من المقيم بصفة أصيل — لا يُعدَّل السعر من الأخصائي. طلب
        الاستدعاء للتعديل يحتاج موافقتك.
      </p>

      {recall?.status === "pending" ? (
        <div className={noteWarnClass}>
          <p className="m-0">
            <strong>طلب استدعاء من المقيم</strong>
            {recall.reason ? ` — ${recall.reason}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="primary" onClick={handleApproveRecall}>
              الموافقة على الاستدعاء
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRejectRecall}>
              رفض
            </Button>
          </div>
        </div>
      ) : null}

      {recall && recall.status !== "pending" ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">طلب الاستدعاء</span>
          <span className="text-left font-medium text-text">
            {recallStatusLabel(recall.status)}
          </span>
        </div>
      ) : null}

      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">الحالة</span>
        <span className="text-left font-medium text-text">
          {evaluatorStatusLabel(submission.status)}
        </span>
      </div>
      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">سعر التقييم</span>
        <span className="text-left font-bold text-primary">
          {formatEvaluatorPriceDisplay(submission.evaluatorPrice)}
        </span>
      </div>
      {submission.reportFileName ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">تقرير المقياس</span>
          <span className="text-left font-medium text-text">
            {submission.reportFileName}{" "}
            <Button
              type="button"
              size="sm"
              onClick={() => openEvaluatorReportPreview(appraisalTask.id)}
            >
              معاينة PDF
            </Button>
          </span>
        </div>
      ) : null}
      {submission.evaluatorNotes.trim() ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">ملاحظات المقيم</span>
          <span className="text-left font-medium text-text">
            {submission.evaluatorNotes}
          </span>
        </div>
      ) : null}

      <h4 className="mb-2.5 mt-4 text-xs font-semibold text-primary">قائمة الفحص</h4>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {allQuestions.map((q) => (
          <li
            key={q.id}
            className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px] last:border-b-0"
          >
            <span className="flex-1 text-text-2">{q.label}</span>
            <strong className="whitespace-nowrap text-text">
              {checklistAnswerLabel(submission.checklist[q.id])}
            </strong>
          </li>
        ))}
        {submission.checklist.q_shared_deed === true ? (
          <>
            <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
              <span className="flex-1 text-text-2">نطاق الملكية (صك مشاع)</span>
              <strong className="whitespace-nowrap text-text">
                {submission.checklist.shared_deed_scope === "full"
                  ? "كامل المساحة"
                  : submission.checklist.shared_deed_scope === "part"
                    ? "جزء محدد"
                    : "—"}
              </strong>
            </li>
            {submission.checklist.shared_deed_scope === "part" ? (
              <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
                <span className="flex-1 text-text-2">نسبة الملكية</span>
                <strong className="whitespace-nowrap text-text">
                  {submission.checklist.shared_deed_percentage || "—"}
                </strong>
              </li>
            ) : null}
          </>
        ) : null}
        {submission.checklist.q_lease_exists === true ? (
          <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
            <span className="flex-1 text-text-2">عقد الإيجار ساري</span>
            <strong className="whitespace-nowrap text-text">
              {checklistAnswerLabel(submission.checklist.q_lease_active)}
            </strong>
          </li>
        ) : null}
        {submission.checklist.q_technical_notes_exists === true ? (
          <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
            <span className="flex-1 text-text-2">ملاحظات فنية</span>
            <strong className="whitespace-nowrap text-text">
              {submission.checklist.technical_notes_text || "—"}
            </strong>
          </li>
        ) : null}
      </ul>
    </RegistrationFormCard>
  );
}
