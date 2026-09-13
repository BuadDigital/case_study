/** Switch the case-study workspace to تبويب مدخلات المعاين (deed↔nature match). */
export const CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT =
  "case-study-workspace-open-appraisal";

/** Switch the case-study workspace to تبويب مدخلات التقييم (report review). */
export const CASE_STUDY_WORKSPACE_OPEN_VALUATION_EVENT =
  "case-study-workspace-open-valuation";

export function openCaseStudyAppraisalTab(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT));
}

export function openCaseStudyValuationTab(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CASE_STUDY_WORKSPACE_OPEN_VALUATION_EVENT));
}
