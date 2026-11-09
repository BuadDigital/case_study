"use client";

import { useMemo } from "react";
import { PropertyDetailEnfazHandoverCard } from "../components/po-intake/PropertyDetailEnfazHandoverCard";
import { PropertyDetailEnfathUpload } from "../components/po-intake/PropertyDetailUploadAssistant";
import { childTasksForCaseStudyParent } from "../lib/app-data/case-study-party-answers";
import type { CaseStudyReportDeeds } from "../lib/app-data/case-study-report-document-model";
import { resolveInspectionTaskForProperty } from "../lib/app-data/documentary-workflow-gates";
import {
  requiresAssignmentDecree,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { usePropertyDetailDocuments } from "../query/property-detail-documents-query";
import { usePropertyDetailPartySubmissionsQuery } from "../query/property-detail-party-submissions-queries";

/**
 * The work page's «الرفع على إنفاذ» section (Omar 2026-11-08): the handover card, then the upload package
 * itself — its «تجهيز المعاملة للرفع» check, the attachments and the fields to copy — so review prepares and
 * uploads without leaving for the details page.
 *
 * How it works: the deed's case-study task gives the appraisal, survey and inspection children; their
 * documents and the parties' packages feed `PropertyDetailEnfathUpload` exactly as the details tab does.
 * Edge cases: mounted only when the section is opened (the frame mounts sections on first open), so the
 * documents fan-out runs only then.
 */
export function WorkUploadSection({
  record,
  property,
  task,
  studyTask,
  tasks,
  reportDeeds,
  showHandoverCard,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** The deed's own case-study task. */
  task: WorkflowTask | null;
  /** The task holding the transaction's study (the holder deed's for linked deeds). */
  studyTask: WorkflowTask | null;
  tasks: WorkflowTask[];
  reportDeeds?: CaseStudyReportDeeds;
  showHandoverCard: boolean;
}) {
  const children = useMemo(
    () => (task ? childTasksForCaseStudyParent(task.id, tasks) : []),
    [task, tasks],
  );
  const appraisalTask = children.find((t) => t.kind === "property-appraisal") ?? null;
  const surveyTask = children.find((t) => t.kind === "engineering-survey") ?? null;
  const inspectionTask = resolveInspectionTaskForProperty({
    tasks,
    parentTask: task,
    appraisalTask,
    surveyTask,
    poNumber: record.poNumber,
    propertyId: property.id,
  });
  const documentSections = usePropertyDetailDocuments({
    property,
    showDecree: requiresAssignmentDecree(record.assignmentType),
    poNumber: record.poNumber,
    surveyTaskId: surveyTask?.id ?? null,
    appraisalTaskId: appraisalTask?.id ?? null,
    inspectionTaskId: inspectionTask?.id ?? null,
  });
  const parties = usePropertyDetailPartySubmissionsQuery({ parentTask: task, allTasks: tasks });

  return (
    <div className="flex flex-col gap-3 pt-3">
      {showHandoverCard ? (
        <PropertyDetailEnfazHandoverCard workOrderId={record.id} propertyId={property.id} />
      ) : null}
      <PropertyDetailEnfathUpload
        record={record}
        property={property}
        task={task}
        studyTask={studyTask}
        reportDeeds={reportDeeds}
        hasSurveyTask={Boolean(surveyTask && surveyTask.status !== "cancelled")}
        parties={parties.data}
        documentSections={documentSections}
        loading={parties.isLoading}
      />
    </div>
  );
}
