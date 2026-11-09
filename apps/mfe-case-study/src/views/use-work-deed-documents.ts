"use client";

import { useMemo } from "react";
import { childTasksForCaseStudyParent } from "../lib/app-data/case-study-party-answers";
import { resolveInspectionTaskForProperty } from "../lib/app-data/documentary-workflow-gates";
import {
  requiresAssignmentDecree,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { usePropertyDetailDocuments } from "../query/property-detail-documents-query";

/**
 * The deed's party tasks and its documents, for the work page's sections that need the files
 * («صور التقرير», «الرفع على إنفاذ») — the same reads as the property details page.
 *
 * How it works: the deed's case-study task gives the appraisal and survey children; the inspection is
 * resolved the way the details page resolves it; the documents fan-out reads every party's files.
 * Edge cases: no case-study task → no children, and the documents hold the deed's own uploads only.
 * Each section mounts on its first open, so the fan-out runs only then.
 */
export function useWorkDeedDocuments({
  record,
  property,
  task,
  tasks,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** The deed's own case-study task. */
  task: WorkflowTask | null;
  tasks: WorkflowTask[];
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
  return { appraisalTask, surveyTask, inspectionTask, documentSections };
}
