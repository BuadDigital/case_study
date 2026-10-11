"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { fetchEvaluatorSubmission } from "../lib/evaluator/evaluator-submission-reads";

/**
 * The appraiser's saved submission for one appraisal task — `null` while he has not saved one.
 * One key, one query function: the report-draft panel and the read-only report preview mount
 * side by side on the property page and must read the same cached value (two query functions
 * under one key let the panel's `null` starve the preview, which waited for a draft forever).
 */
export function evaluatorSubmissionQueryOptions(appraisalTaskId: string) {
  return queryOptions({
    queryKey: appDataKeys.evaluatorSubmission(appraisalTaskId),
    queryFn: () => fetchEvaluatorSubmission(appraisalTaskId),
    staleTime: 30_000,
  });
}

export function useEvaluatorSubmissionQuery(appraisalTaskId: string) {
  return useQuery(evaluatorSubmissionQueryOptions(appraisalTaskId));
}
