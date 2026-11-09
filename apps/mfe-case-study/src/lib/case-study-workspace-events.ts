import { CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT } from "@platform/app-shared/events/app-events";

export function openCaseStudyAppraisalTab(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT));
}
