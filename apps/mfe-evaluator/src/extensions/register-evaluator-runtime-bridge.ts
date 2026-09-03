"use client";

/**
 * Registers evaluator runtime helpers into `@platform/app-shared` so
 * `@case-study/mfe` never imports `@evaluator/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerEvaluatorRuntimeBridge } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import {
  appraiserOnlyCaseStudyChecklistItems,
  caseStudyAnswerDisplayLabel,
  isEvaluatorChecklistQuestionAssignedToAppraiser,
  mergeEvaluatorChecklistFromCaseStudy,
} from "../lib/evaluator/evaluator-checklist-case-study-sync";
import { getCachedEvaluatorDepositCertificate } from "../lib/evaluator/evaluator-deposit-attachments";
import { findSiblingInspectionTask } from "../lib/evaluator/evaluator-inspection-gate";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserQueueStatusBadge,
  appraiserQueueStatusGroup,
  appraiserSurveyDone,
  findSiblingSurveyTask,
} from "../lib/evaluator/evaluator-readiness";
import {
  filterAppraiserListedTasks,
} from "../lib/evaluator/evaluator-queue";
import { prefetchEvaluatorReport } from "../lib/evaluator/evaluator-report-attachments";
import { getCachedEvaluatorReport } from "../lib/evaluator/evaluator-report-attachments";
import { loadEvaluatorSubmission } from "../lib/evaluator/evaluator-submission-model";
import { fetchEvaluatorSubmission } from "../lib/evaluator/evaluator-submission-reads";
import { syncEvaluatorChecklistFromPartyCaseStudy } from "../lib/evaluator/evaluator-submission-commands";
import type { EvaluatorChecklistAnswers } from "../lib/evaluator/evaluator-window-data";

let registered = false;

export function ensureEvaluatorRuntimeBridgeRegistered(): void {
  if (registered) return;
  registered = true;

  registerEvaluatorRuntimeBridge({
    filterAppraiserListedTasks,
    appraiserQueueStatusGroup: (task, all) =>
      appraiserQueueStatusGroup(task as WorkflowTask, all as WorkflowTask[]),
    appraiserQueueStatusBadge: (task, all) =>
      appraiserQueueStatusBadge(task as WorkflowTask, all as WorkflowTask[]),
    appraiserInspectionDone: (task, all) =>
      appraiserInspectionDone(task as WorkflowTask, all as WorkflowTask[]),
    appraiserSurveyDone: (task, all) =>
      appraiserSurveyDone(task as WorkflowTask, all as WorkflowTask[]),
    appraiserNeedsSurvey: (task, all) =>
      appraiserNeedsSurvey(task as WorkflowTask, all as WorkflowTask[]),
    findSiblingInspectionTask: (task, all) =>
      findSiblingInspectionTask(task as WorkflowTask, all as WorkflowTask[]),
    findSiblingSurveyTask: (task, all) =>
      findSiblingSurveyTask(task as WorkflowTask, all as WorkflowTask[]),
    loadEvaluatorSubmission,
    fetchEvaluatorSubmission,
    prefetchEvaluatorReport: (taskId) => {
      void prefetchEvaluatorReport(taskId);
    },
    getCachedEvaluatorReport,
    getCachedEvaluatorDepositCertificate,
    mergeEvaluatorChecklistFromCaseStudy: (
      checklist,
      answers,
      remarks,
      options,
    ) =>
      mergeEvaluatorChecklistFromCaseStudy(
        checklist as EvaluatorChecklistAnswers,
        answers as Parameters<typeof mergeEvaluatorChecklistFromCaseStudy>[1],
        remarks as Parameters<typeof mergeEvaluatorChecklistFromCaseStudy>[2],
        options,
      ),
    appraiserOnlyCaseStudyChecklistItems: (roles) =>
      appraiserOnlyCaseStudyChecklistItems(
        roles as Parameters<typeof appraiserOnlyCaseStudyChecklistItems>[0],
      ),
    caseStudyAnswerDisplayLabel: (answer) =>
      caseStudyAnswerDisplayLabel(
        answer as Parameters<typeof caseStudyAnswerDisplayLabel>[0],
      ),
    isEvaluatorChecklistQuestionAssignedToAppraiser: (roles, key) =>
      isEvaluatorChecklistQuestionAssignedToAppraiser(
        roles as Parameters<
          typeof isEvaluatorChecklistQuestionAssignedToAppraiser
        >[0],
        key as Parameters<
          typeof isEvaluatorChecklistQuestionAssignedToAppraiser
        >[1],
      ),
    syncEvaluatorChecklistFromPartyCaseStudy: (taskId, options) => {
      void syncEvaluatorChecklistFromPartyCaseStudy(taskId, options);
    },
  });
}
