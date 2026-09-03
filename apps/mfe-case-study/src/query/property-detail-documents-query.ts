"use client";

import {
  fetchEngineeringSurveySubmission,
  prefetchEngineeringSurveyDocuments,
} from "../lib/engineering-survey-bridge";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-engineering-survey-events";
import {
  fetchEvaluatorSubmission,
  prefetchEvaluatorReport,
} from "../lib/evaluator-bridge";
import { useEffect, useRef, useState } from "react";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-evaluator-events";
import {
  prefetchPropertyDocAttachments,
  subscribeAssignmentDocCache,
} from "../lib/app-data/assignment-doc-attachments";
import { prefetchInspectorWorkspacePhotos } from "../lib/app-data/inspector-photo-upload";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/app-data/inspector-workspace-model";
import { fetchInspectorWorkspace } from "../lib/app-data/inspector-workspace-reads";
import {
  collectPropertyDetailDocumentSections,
  type PropertyDetailDocumentSection,
} from "../lib/app-data/property-detail-documents";
import type { PoPropertyIntake } from "../lib/app-data/po-intake-data";

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

  // Latest assemble fn via a live ref — lets deps use primary keys
  // instead of property-object identity that re-triggered a full fetch every paint.
  const collectRef = useRef(collect);
  collectRef.current = collect;

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setSections(collectRef.current());
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
    // Property key, not identity — an unstabilized caller object re-ran every fetch every paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    property.id,
    showDecree,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  ]);

  return sections;
}
