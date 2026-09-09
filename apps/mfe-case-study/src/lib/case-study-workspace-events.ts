/** Switch the case-study workspace to تبويب تقييم العقار (deed↔nature match). */
export const CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT =
  "case-study-workspace-open-appraisal";

export function openCaseStudyAppraisalTab(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT));
}
