"use client";

import { useEffect, useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Button, cn } from "@platform/design-system";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe";
import { useCaseStudyInfoRolesQuery } from "@settings/mfe/query/settings-queries";
import type { WorkflowTask } from "@case-study/mfe";
import {
  loadPartyCaseStudyFormDraft,
  PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
  type CaseStudyFormDraft,
} from "@case-study/mfe";
import { findAppraisalChildForParent } from "../../lib/evaluator/evaluator-inspection-gate";
import { openEvaluatorReportPreview } from "../../lib/evaluator/evaluator-report-attachments";
import {
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  fetchEvaluatorSubmissionSnapshot,
  loadEvaluatorSubmission,
} from "../../lib/evaluator/evaluator-submission-storage";
import { PartyRecallAdvisorySection } from "@case-study/mfe/components/party-tasks/PartyRecallAdvisorySection";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";
import {
  checklistAnswerLabel,
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
  evaluatorStatusLabel,
  formatEvaluatorPriceDisplay,
  type EvaluatorChecklistAnswers,
} from "../../lib/evaluator/evaluator-window-data";
import {
  appraiserOnlyCaseStudyChecklistItems,
  caseStudyAnswerDisplayLabel,
  filterEvaluatorChecklistQuestions,
  isEvaluatorChecklistQuestionAssignedToAppraiser,
  mergeEvaluatorChecklistFromCaseStudy,
} from "../../lib/evaluator/evaluator-checklist-case-study-sync";
const noteWarnClass = cn(
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text",
);

const infoRowClass =
  "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();

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
  const [partyDraft, setPartyDraft] = useState<CaseStudyFormDraft | null>(null);
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;

  const appraisalTask = useMemo(
    () => findAppraisalChildForParent(parentTask.id, propertyId, tasks),
    [parentTask.id, propertyId, tasks, refreshKey],
  );

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
      window.removeEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!appraisalTask) {
      setPartyDraft(null);
      return;
    }
    let cancelled = false;
    void loadPartyCaseStudyFormDraft(appraisalTask.id).then((draft) => {
      if (!cancelled) setPartyDraft(draft);
    }).catch((err: unknown) => {
      if (!cancelled) console.warn("Appraisal party draft load failed:", err);
    });
    return () => {
      cancelled = true;
    };
  }, [appraisalTask?.id, refreshKey]);

  useEffect(() => {
    if (!appraisalTask) return;
    void fetchEvaluatorSubmissionSnapshot(appraisalTask.id).then(() => {
      setRefreshKey((k) => k + 1);
    }).catch((err: unknown) => {
      console.warn("Evaluator submission snapshot prefetch failed:", err);
    });
  }, [appraisalTask?.id]);

  const submission = useMemo(() => {
    if (!appraisalTask) return null;
    return loadEvaluatorSubmission(appraisalTask.id);
  }, [appraisalTask, refreshKey]);

  const displayChecklist = useMemo((): EvaluatorChecklistAnswers | null => {
    if (!submission) return null;
    if (!partyDraft) return submission.checklist;
    return mergeEvaluatorChecklistFromCaseStudy(
      submission.checklist,
      partyDraft.answers,
      {
        deedRemarks: partyDraft.deedRemarks,
        componentsRemarks: partyDraft.componentsRemarks,
      },
    );
  }, [submission, partyDraft]);

  const assignedQuestions = useMemo(
    () =>
      filterEvaluatorChecklistQuestions(
        [...EVALUATOR_SIMPLE_QUESTIONS, ...EVALUATOR_CONDITIONAL_QUESTIONS],
        infoRolesMatrix,
      ),
    [infoRolesMatrix],
  );

  const appraiserOnlyQuestions = useMemo(
    () => appraiserOnlyCaseStudyChecklistItems(infoRolesMatrix),
    [infoRolesMatrix],
  );

  const assignedKeys = useMemo(
    () => new Set(assignedQuestions.map((q) => q.id)),
    [assignedQuestions],
  );

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

  const checklist = displayChecklist ?? submission.checklist;

  return (
    <RegistrationFormCard title="بيانات المقيم العقاري (استرشادي — للقراءة فقط)">
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        هذه البيانات من المقيم بصفة أصيل — لا يُعدَّل السعر من الأخصائي. طلب
        الاسترجاع للتعديل يحتاج موافقتك.
      </p>

      <PartyRecallAdvisorySection
        taskId={appraisalTask.id}
        partyLabel="المقيم العقاري"
        refreshKey={refreshKey}
        onResolved={() => {
          setRefreshKey((k) => k + 1);
          onReopened?.();
        }}
      />

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
      {assignedQuestions.length === 0 && appraiserOnlyQuestions.length === 0 ? (
        <p className="m-0 text-[11px] leading-relaxed text-text-3">
          لا أسئلة مسندة للمقيم العقاري في «علاقة المستخدم بالمعلومة».
        </p>
      ) : (
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {assignedQuestions.map((q) => (
          <li
            key={q.id}
            className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px] last:border-b-0"
          >
            <span className="flex-1 text-text-2">{q.label}</span>
            <strong className="whitespace-nowrap text-text">
              {checklistAnswerLabel(checklist[q.id])}
            </strong>
          </li>
        ))}
        {appraiserOnlyQuestions.map((item) => (
          <li
            key={item.caseStudyKey}
            className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px] last:border-b-0"
          >
            <span className="flex-1 text-text-2">{item.label}</span>
            <strong className="whitespace-nowrap text-text">
              {caseStudyAnswerDisplayLabel(partyDraft?.answers[item.caseStudyKey])}
            </strong>
          </li>
        ))}
        {assignedKeys.has("q_shared_deed") && checklist.q_shared_deed === true ? (
          <>
            <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
              <span className="flex-1 text-text-2">نطاق الملكية (صك مشاع)</span>
              <strong className="whitespace-nowrap text-text">
                {checklist.shared_deed_scope === "full"
                  ? "كامل المساحة"
                  : checklist.shared_deed_scope === "part"
                    ? "جزء محدد"
                    : "—"}
              </strong>
            </li>
            {checklist.shared_deed_scope === "part" ? (
              <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
                <span className="flex-1 text-text-2">نسبة الملكية</span>
                <strong className="whitespace-nowrap text-text">
                  {checklist.shared_deed_percentage || "—"}
                </strong>
              </li>
            ) : null}
          </>
        ) : null}
        {assignedKeys.has("q_lease_exists") && checklist.q_lease_exists === true ? (
          <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
            <span className="flex-1 text-text-2">عقد الإيجار ساري</span>
            <strong className="whitespace-nowrap text-text">
              {isEvaluatorChecklistQuestionAssignedToAppraiser(
                infoRolesMatrix,
                "q_lease_active",
              )
                ? checklistAnswerLabel(checklist.q_lease_active)
                : "—"}
            </strong>
          </li>
        ) : null}
        {assignedKeys.has("q_technical_notes_exists") &&
        checklist.q_technical_notes_exists === true ? (
          <li className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[11px]">
            <span className="flex-1 text-text-2">ملاحظات فنية</span>
            <strong className="whitespace-nowrap text-text">
              {checklist.technical_notes_text || "—"}
            </strong>
          </li>
        ) : null}
      </ul>
      )}
    </RegistrationFormCard>
  );
}
