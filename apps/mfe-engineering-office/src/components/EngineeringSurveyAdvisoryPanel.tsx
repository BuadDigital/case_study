"use client";

import { useEffect, useMemo, useState } from "react";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Button, InlineLoadingSkeleton, Label, cn, formControlClassName } from "@platform/design-system";
import type { WorkflowTask } from "@case-study/mfe";
import { findSurveyChildForParent } from "../lib/engineering-survey-task";
import type { EngineeringSurveySubmission } from "../lib/engineering-survey-data";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  engineeringSurveyStatusLabel,
  loadEngineeringSurveySubmissionAsync,
  acceptEngineeringSurveySubmission,
  reopenEngineeringSurveySubmission,
} from "../lib/engineering-survey-submission-storage";
import { PartyRecallAdvisorySection } from "@case-study/mfe/components/party-tasks/PartyRecallAdvisorySection";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";

function formatCoordsDisplay(lat: string, lng: string): string {
  const latTrim = lat.trim();
  const lngTrim = lng.trim();
  if (!latTrim && !lngTrim) return "";
  if (latTrim && lngTrim) return `${latTrim}، ${lngTrim}`;
  return latTrim || lngTrim;
}

const noteWarnClass = "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text";

const infoRowClass = "flex items-baseline justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0";

export function EngineeringSurveyAdvisoryPanel({
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
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [feeAccrued, setFeeAccrued] = useState(false);
  const [submission, setSubmission] = useState<EngineeringSurveySubmission | null>(
    null,
  );
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener(ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(
        ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
      window.removeEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    };
  }, []);

  const surveyTask = useMemo(
    () => findSurveyChildForParent(parentTask.id, propertyId, tasks),
    [parentTask.id, propertyId, tasks, refreshKey],
  );

  useEffect(() => {
    if (!surveyTask) {
      setSubmission(null);
      return;
    }
    let cancelled = false;
    setLoadingSubmission(true);
    void loadEngineeringSurveySubmissionAsync({
      taskId: surveyTask.id,
      propertyId: surveyTask.propertyId,
      poNumber: surveyTask.poNumber,
    }).then((loaded) => {
      if (!cancelled) {
        setSubmission(loaded);
        setLoadingSubmission(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [surveyTask, refreshKey]);

  if (!surveyTask) {
    return (
      <RegistrationFormCard title="بيانات المكتب الهندسي (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          لم تُسند مهمة الرفع المساحي بعد لهذا العقار.
        </p>
      </RegistrationFormCard>
    );
  }

  if (loadingSubmission) {
    return (
      <RegistrationFormCard title="بيانات المكتب الهندسي (استرشادي)">
        <InlineLoadingSkeleton />
      </RegistrationFormCard>
    );
  }

  if (!submission || submission.status === "draft") {
    return (
      <RegistrationFormCard title="بيانات المكتب الهندسي (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          المكتب الهندسي لم يُرسل الرفع المساحي بعد.
        </p>
      </RegistrationFormCard>
    );
  }

  async function handleReturnForCorrection() {
    if (!surveyTask) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    const reopened = await reopenEngineeringSurveySubmission(
      surveyTask.id,
      trimmed,
    );
    if (!reopened.ok) {
      setReturnError(reopened.error);
      return;
    }
    setSubmission(reopened.data);
    setReturnOpen(false);
    setReturnNote("");
    setReturnError(null);
    setFeeAccrued(false);
    setRefreshKey((k) => k + 1);
    onReturned?.();
  }

  async function handleAcceptOutputs() {
    if (!surveyTask) return;
    setAcceptBusy(true);
    setAcceptError(null);
    try {
      const accepted = await acceptEngineeringSurveySubmission(surveyTask.id);
      if (!accepted.ok) {
        setAcceptError(accepted.error);
        return;
      }
      setSubmission(accepted.data);
      setFeeAccrued(true);
      setRefreshKey((k) => k + 1);
      onReturned?.();
    } finally {
      setAcceptBusy(false);
    }
  }

  const coords = formatCoordsDisplay(submission.latitude, submission.longitude);
  const answeredCount = submission.checklist.filter(
    (row) => row.answer === "yes" || row.answer === "no",
  ).length;

  return (
    <RegistrationFormCard title="بيانات المكتب الهندسي (استرشادي — للقراءة فقط)">
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        هذه البيانات من المكتب الهندسي — قبول المخرجات يُنشئ استحقاق الأتعاب من
        جدول التسعير. إعادة الرفع للتصحيح لا تُنشئ أتعاباً جديدة.
      </p>

      <PartyRecallAdvisorySection
        taskId={surveyTask.id}
        partyLabel="المكتب الهندسي"
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

      {feeAccrued ? (
        <div className="mb-3 rounded-[var(--radius-DEFAULT)] border border-success/30 border-e-[3px] border-e-success bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3.5 py-2.5 text-xs leading-relaxed text-success-text">
          تم قبول المخرجات واستحقاق أتعاب المكتب الهندسي من جدول التسعير.
        </div>
      ) : null}

      {submission.status === "submitted" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!returnOpen ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={acceptBusy || feeAccrued}
                onClick={() => {
                  void handleAcceptOutputs();
                }}
              >
                {feeAccrued ? "تم القبول" : "قبول المخرجات"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={acceptBusy}
                onClick={() => {
                  setReturnOpen(true);
                  setReturnError(null);
                }}
              >
                إعادة للتصحيح
              </Button>
            </>
          ) : (
            <div className="w-full">
              <Label htmlFor="eng-return-note" className="text-xs">
                سبب الإرجاع للتصحيح <span className="text-danger-text">*</span>
              </Label>
              <textarea
                id="eng-return-note"
                className={cn(
                  formControlClassName,
                  "mt-1 min-h-[72px] resize-y py-2 leading-relaxed",
                )}
                rows={3}
                value={returnNote}
                placeholder="اذكر ما يجب على المكتب الهندسي تصحيحه…"
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
                  onClick={() => {
                    void handleReturnForCorrection();
                  }}
                >
                  تأكيد الإرجاع
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReturnOpen(false);
                    setReturnNote("");
                    setReturnError(null);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
          {acceptError ? (
            <p className="w-full text-[11px] text-danger-text">{acceptError}</p>
          ) : null}
        </div>
      ) : null}

      <div className={infoRowClass}>
        <span className="shrink-0 text-text-3">الحالة</span>
        <span className="text-left font-medium text-text">
          {engineeringSurveyStatusLabel(submission.status)}
        </span>
      </div>
      {coords ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">الإحداثيات</span>
          <span className="text-left font-medium text-text" dir="ltr">
            {coords}
          </span>
        </div>
      ) : null}
      {submission.surveyReportFileName.trim() ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">تقرير الرفع المساحي</span>
          <span className="text-left font-medium text-text">
            {submission.surveyReportFileName.trim()}
          </span>
        </div>
      ) : null}
      {submission.siteLetterFileName.trim() ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">خطاب الموقع</span>
          <span className="text-left font-medium text-text">
            {submission.siteLetterFileName.trim()}
          </span>
        </div>
      ) : null}
      {answeredCount > 0 ? (
        <div className={infoRowClass}>
          <span className="shrink-0 text-text-3">البنود المكتملة</span>
          <span className="text-left font-medium text-text">
            {answeredCount} / 13
          </span>
        </div>
      ) : null}
    </RegistrationFormCard>
  );
}
