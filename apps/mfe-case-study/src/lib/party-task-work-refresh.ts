import type { QueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { PageId } from "@platform/types";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";

const PARTY_PAGE_SUBMISSION_EVENTS: Partial<Record<PageId, string>> = {
  "property-inspection": FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  "active-inspection": FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  "active-survey": ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  "property-appraisal": EVALUATOR_SUBMISSION_CHANGED_EVENT,
};

/** Invalidate shared queries + dispatch party submission events after task work completes. */
export function refreshPartyTaskWorkQueries(
  queryClient: QueryClient,
  pageId: PageId,
): void {
  void queryClient.invalidateQueries({
    queryKey: appDataKeys.workflowTasks(),
  });
  if (pageId === "property-inspection" || pageId === "active-inspection") {
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.fieldInspectionWorkspaces(),
    });
  }
  const eventName = PARTY_PAGE_SUBMISSION_EVENTS[pageId];
  if (eventName && typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}
