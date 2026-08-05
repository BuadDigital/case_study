"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-evaluator-events";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-engineering-survey-events";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-field-inspection-events";
import { GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT } from "../lib/prototype/government-review-work-storage";
import {
  loadPropertyDetailPartySubmissions,
  type PropertyDetailPartySubmissionsMap,
} from "../lib/prototype/property-detail-party-submissions";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import { TASKS_CHANGED_EVENT } from "./case-study-queries";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function propertyDetailPartySubmissionsQueryKey(parentTaskId: string) {
  return prototypeKeys.propertyDetailPartySubmissions(parentTaskId);
}

/** Fetches every party-role submission as one unit (parallel API + prototype reads). */
export function usePropertyDetailPartySubmissionsQuery(input: {
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const parentTaskId = input.parentTask?.id ?? "";
  const enabled = input.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: propertyDetailPartySubmissionsQueryKey(parentTaskId),
      });
    };
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, invalidate);
    window.addEventListener(ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT, invalidate);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, invalidate);
    window.addEventListener(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT, invalidate);
    window.addEventListener(TASKS_CHANGED_EVENT, invalidate);
    return () => {
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, invalidate);
      window.removeEventListener(
        ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
        invalidate,
      );
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        invalidate,
      );
      window.removeEventListener(
        GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
        invalidate,
      );
      window.removeEventListener(TASKS_CHANGED_EVENT, invalidate);
    };
  }, [enabled, parentTaskId, queryClient]);

  return useQuery<PropertyDetailPartySubmissionsMap>({
    queryKey: propertyDetailPartySubmissionsQueryKey(parentTaskId || "none"),
    queryFn: () =>
      loadPropertyDetailPartySubmissions({
        parentTask: input.parentTask,
        allTasks: input.allTasks,
      }),
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
