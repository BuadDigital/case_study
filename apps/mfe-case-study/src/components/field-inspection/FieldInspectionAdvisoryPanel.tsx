"use client";

import { useEffect, useMemo, useState } from "react";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { dmy, hhmm } from "@platform/app-shared/format/date";
import { inspectionLateUploadAtUtc } from "@platform/app-shared/app-data/inspector-workspace-data";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Button, InlineLoadingSkeleton } from "@platform/ui-kit";
import { ReturnInspectionDialog } from "../po-intake/ReturnInspectionDialog";
import { PartyRecallAdvisorySection } from "../party-tasks/PartyRecallAdvisorySection";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/app-data/party-task-recall-model";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { findInspectionChildForParent } from "../../lib/field-inspection-task";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../../lib/app-data/inspector-workspace-model";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import {
  inspectorPhotoCoverageLabel,
  inspectorWorkspaceStatusLabel,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";

export function FieldInspectionAdvisoryPanel({
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
  const [submission, setSubmission] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
      window.removeEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, refresh);
    };
  }, []);

  const inspectionTask = useMemo(
    () => findInspectionChildForParent(parentTask.id, propertyId, tasks),
    [parentTask.id, propertyId, tasks],
  );

  useEffect(() => {
    if (!inspectionTask) {
      setSubmission(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingSubmission(true);
    setLoadError(null);
    void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((loaded) => {
      if (!cancelled) {
        setSubmission(loaded);
        setLoadingSubmission(false);
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        setSubmission(null);
        setLoadingSubmission(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : "تعذّر تحميل بيانات المعاينة الميدانية",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionTask, refreshKey]);

  if (!inspectionTask) {
    return (
      <RegistrationFormCard title="معاينة العقار (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          لم تُسند مهمة المعاينة الميدانية بعد لهذا العقار.
        </p>
      </RegistrationFormCard>
    );
  }

  // Only the first load shows the skeleton — a refresh keeps the card (and an open dialog) mounted.
  if (loadingSubmission && !submission) {
    return (
      <RegistrationFormCard title="معاينة العقار (استرشادي)">
        <InlineLoadingSkeleton />
      </RegistrationFormCard>
    );
  }

  if (loadError) {
    return (
      <RegistrationFormCard title="معاينة العقار (استرشادي)">
        <p className="text-xs leading-relaxed text-danger-text">{loadError}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          إعادة المحاولة
        </Button>
      </RegistrationFormCard>
    );
  }

  if (!submission || submission.status === "draft") {
    return (
      <RegistrationFormCard title="معاينة العقار (استرشادي)">
        <p className="text-xs leading-relaxed text-text-3">
          المعاين لم يُرسل التقرير الميداني بعد.
        </p>
      </RegistrationFormCard>
    );
  }

  const lateUploadAt = inspectionLateUploadAtUtc(submission);

  return (
    <RegistrationFormCard title="معاينة العقار (استرشادي — للقراءة فقط)">
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        ملخص من تقرير المعاين — يمكنك إعادة المهمة للتصحيح أو الموافقة على طلب
        الاسترجاع.
      </p>

      <PartyRecallAdvisorySection
        taskId={inspectionTask.id}
        partyLabel="المعاين الميداني"
        refreshKey={refreshKey}
        onResolved={() => {
          setRefreshKey((k) => k + 1);
          onReturned?.();
        }}
      />

      {submission.status === "reopened" && submission.returnNote?.trim() ? (
        <ReturnedForCorrectionNote note={submission.returnNote} />
      ) : null}

      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <span className="text-text-3">الحالة</span>
          <span className="font-medium text-text">
            {inspectorWorkspaceStatusLabel(submission.status, {
              accepted: Boolean(submission.acceptedAtUtc?.trim()),
            })}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <span className="text-text-3">تاريخ المعاينة</span>
          <span className="font-medium text-text">
            {[submission.inspectionDate, submission.inspectionTime]
              .filter(Boolean)
              .join(" ") || "—"}
          </span>
        </div>
        {lateUploadAt ? (
          <div className="flex justify-between gap-3 border-b border-border py-2">
            <span className="text-text-3">وقت الرفع</span>
            <span className="font-medium text-text">
              {dmy(lateUploadAt)} {hhmm(lateUploadAt)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <span className="text-text-3">تغطية الصور</span>
          <span className="font-medium text-text">
            {inspectorPhotoCoverageLabel(submission)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <span className="text-text-3">الملاحظات</span>
          <span className="font-medium text-text">
            {submission.observations.length}
          </span>
        </div>
      </div>

      {submission.status === "submitted" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReturnOpen(true)}
          >
            {submission.acceptedAtUtc?.trim()
              ? "إلغاء الاعتماد وإعادة للتصحيح"
              : "إعادة للتصحيح"}
          </Button>
        </div>
      ) : null}
      {/* Kept outside the status gate: the outcomes stay on screen after the status flips. */}
      <ReturnInspectionDialog
        open={returnOpen}
        inspectionTaskId={inspectionTask.id}
        onClose={() => setReturnOpen(false)}
        onReturned={() => {
          setRefreshKey((k) => k + 1);
          onReturned?.();
        }}
      />
    </RegistrationFormCard>
  );
}
