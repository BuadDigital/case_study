"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ValuationReportLoading } from "./ValuationReportLoading";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { EvaluatorValuationReportPreviewProps } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { findSiblingInspectionTask } from "../../lib/evaluator/evaluator-inspection-gate";
import { findSiblingSurveyTask } from "../../lib/evaluator/evaluator-readiness";
import { fetchEvaluatorSubmission } from "../../lib/evaluator/evaluator-submission-reads";
import { createEvaluatorDraft } from "../../lib/evaluator/evaluator-window-data";
import { EvaluatorValuationReportOutputTab } from "./EvaluatorValuationReportOutputTab";

/**
 * The appraiser's «تقرير التقييم» tab, read-only, for the property page: same report, same
 * red missing-field marks, no print / PDF actions. Never creates a draft.
 */
export function EvaluatorValuationReportPreview({
  appraisalTask,
  allTasks,
  property,
}: EvaluatorValuationReportPreviewProps) {
  const { data: staffResult } = useStaffUsersQuery();
  const assignedAppraiserName = useMemo(
    () =>
      resolveAssigneeDisplayName({
        assigneeName: appraisalTask.assigneeName,
        assigneeId: appraisalTask.assigneeId,
        staffUsers: staffResult?.users ?? [],
      }),
    [appraisalTask.assigneeName, appraisalTask.assigneeId, staffResult?.users],
  );

  const draftQuery = useQuery({
    queryKey: ["evaluator-submission-preview", appraisalTask.id],
    staleTime: 30_000,
    queryFn: async () =>
      (await fetchEvaluatorSubmission(appraisalTask.id)) ??
      createEvaluatorDraft({
        taskId: appraisalTask.id,
        propertyId: appraisalTask.propertyId ?? property.id,
        poNumber: appraisalTask.poNumber,
        assignmentType: appraisalTask.assignmentType,
      }),
  });

  if (draftQuery.isError) {
    return (
      <p className="m-0 text-[13px] text-danger-text">
        تعذّر تحميل تقرير التقييم — أعد المحاولة.
      </p>
    );
  }
  if (!draftQuery.data) return <ValuationReportLoading />;

  const inspectionTaskId =
    appraisalTask.fieldInspectionTaskId?.trim() ||
    findSiblingInspectionTask(appraisalTask, allTasks)?.id ||
    null;
  const surveyTaskId = findSiblingSurveyTask(appraisalTask, allTasks)?.id ?? null;

  return (
    <EvaluatorValuationReportOutputTab
      draft={draftQuery.data}
      property={property}
      inspectionTaskId={inspectionTaskId}
      surveyTaskId={surveyTaskId}
      assignedAppraiserName={assignedAppraiserName}
      showActions={false}
      showMissingFields={false}
    />
  );
}
