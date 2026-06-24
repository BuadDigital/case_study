import type { QueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import type { PageId } from "@platform/types";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "./case-study-engineering-survey-events";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "./case-study-evaluator-events";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "./case-study-field-inspection-events";
import { GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT } from "./prototype/government-review-work-storage";
import { VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT } from "./prototype/valuation-coordination-work-storage";

const PARTY_PAGE_SUBMISSION_EVENTS: Partial<Record<PageId, string>> = {
  "property-inspection": FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  "active-survey": ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  "property-appraisal": EVALUATOR_SUBMISSION_CHANGED_EVENT,
  "government-review": GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
  "valuation-coordination": VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT,
};

/** Invalidate shared queries + dispatch party submission events after task work completes. */
export function refreshPartyTaskWorkQueries(
  queryClient: QueryClient,
  pageId: PageId,
): void {
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.workflowTasks(),
  });
  if (pageId === "property-inspection") {
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.fieldInspectionWorkspaces(),
    });
  }
  const eventName = PARTY_PAGE_SUBMISSION_EVENTS[pageId];
  if (eventName && typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}
