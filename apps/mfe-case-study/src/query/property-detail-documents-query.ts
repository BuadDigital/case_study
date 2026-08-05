"use client";

import {
  fetchEngineeringSurveySubmission,
  prefetchEngineeringSurveyDocuments,
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
} from "@engineering-office/mfe";
import {
  fetchEvaluatorSubmission,
  prefetchEvaluatorReport,
} from "@evaluator/mfe";
import { useEffect, useState } from "react";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-evaluator-events";
import {
  prefetchPropertyDocAttachments,
  subscribeAssignmentDocCache,
} from "../lib/prototype/assignment-doc-attachments";
import { prefetchInspectorWorkspacePhotos } from "../lib/prototype/inspector-photo-upload";
import {
  fetchInspectorWorkspace,
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
} from "../lib/prototype/inspector-workspace-storage";
import {
  collectPropertyDetailDocumentSections,
  type PropertyDetailDocumentSection,
} from "../lib/prototype/property-detail-documents";
import type { PoPropertyIntake } from "../lib/prototype/po-intake-data";

export function usePropertyDetailDocuments(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  surveyTaskId: string | null;
  appraisalTaskId: string | null;
  inspectionTaskId: string | null;
  enabled?: boolean;
}): PropertyDetailDocumentSection[] {
  const {
    property,
    showDecree,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
    enabled = true,
  } = input;

  const collect = () =>
    collectPropertyDetailDocumentSections({
      property,
      showDecree,
      poNumber,
      surveyTaskId,
      appraisalTaskId,
      inspectionTaskId,
    });

  const [sections, setSections] = useState<PropertyDetailDocumentSection[]>(
    () => (enabled ? collect() : []),
  );

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setSections(collect());
    };
    refresh();

    void Promise.all([
      prefetchPropertyDocAttachments(poNumber, property.id),
      surveyTaskId
        ? fetchEngineeringSurveySubmission(surveyTaskId).then(async () => {
            await prefetchEngineeringSurveyDocuments(surveyTaskId);
          })
        : Promise.resolve(null),
      appraisalTaskId
        ? fetchEvaluatorSubmission(appraisalTaskId).then(async () => {
            await prefetchEvaluatorReport(appraisalTaskId);
          })
        : Promise.resolve(null),
      inspectionTaskId
        ? fetchInspectorWorkspace(inspectionTaskId).then(async (workspace) => {
            if (workspace) await prefetchInspectorWorkspacePhotos(workspace);
            return workspace;
          })
        : Promise.resolve(null),
    ]).then(refresh);

    const unsubDocs = subscribeAssignmentDocCache(refresh);
    window.addEventListener(
      ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
      refresh,
    );
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);

    return () => {
      cancelled = true;
      unsubDocs();
      window.removeEventListener(
        ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
    };
  }, [
    enabled,
    property,
    showDecree,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  ]);

  return sections;
}
