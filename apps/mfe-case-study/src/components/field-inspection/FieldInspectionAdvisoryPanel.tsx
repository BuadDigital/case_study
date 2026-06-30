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
import { PartyRecallAdvisorySection } from "../party-tasks/PartyRecallAdvisorySection";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { findInspectionChildForParent } from "../../lib/field-inspection-task";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  loadInspectorWorkspaceSnapshot,
  reopenInspectorWorkspace,
} from "../../lib/prototype/inspector-workspace-storage";
import {
  inspectorPhotoCoverageLabel,
  inspectorWorkspaceStatusLabel,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";

const noteWarnClass =
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text";

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
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [loadingSubmission, setLoadingSubmission] = useState(false);

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
    [parentTask.id, propertyId, tasks, refreshKey],
  );

  useEffect(() => {
    if (!inspectionTask) {
      setSubmission(null);
      return;
    }
    let cancelled = false;
    setLoadingSubmission(true);
    void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((loaded) => {
      if (!cancelled) {
        setSubmission(loaded);
        setLoadingSubmission(false);
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

  if (loadingSubmission) {
    return (
      <RegistrationFormCard title="معاينة العقار (استرشادي)">
        <InlineLoadingSkeleton />
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

  async function handleReturnForCorrection() {
    if (!inspectionTask) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    const reopened = await reopenInspectorWorkspace(inspectionTask.id, trimmed);
    if (!reopened) {
      setReturnError("تعذّر إعادة المعاينة للتصحيح — حاول لاحقاً");
      return;
    }
    setSubmission(reopened);
    setReturnOpen(false);
    setReturnNote("");
    setReturnError(null);
    setRefreshKey((k) => k + 1);
    onReturned?.();
  }

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
        <div className={noteWarnClass}>
          <p className="m-0">
            <strong>مُعاد للتصحيح</strong> — {submission.returnNote.trim()}
          </p>
        </div>
      ) : null}

      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <span className="text-text-3">الحالة</span>
          <span className="font-medium text-text">
            {inspectorWorkspaceStatusLabel(submission.status)}
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
              <Label htmlFor="inspection-return-note" className="text-xs">
                سبب الإرجاع للتصحيح{" "}
                <span className="text-danger-text">*</span>
              </Label>
              <textarea
                id="inspection-return-note"
                className={cn(
                  formControlClassName,
                  "mt-1 min-h-[72px] text-xs",
                )}
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
              />
              {returnError ? (
                <p className="mt-1 text-xs text-danger-text">{returnError}</p>
              ) : null}
              <div className="mt-2 flex gap-2">
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
