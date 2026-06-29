/** Fired only after an explicit user submit action (e.g. حفظ وإرسال الرفع). */
export const ENGINEERING_SURVEY_SUBMITTED_EVENT = "engineering-survey-submitted";

/** Fired only after the appraiser submits their report. */
export const EVALUATOR_SUBMITTED_EVENT = "evaluator-submitted";

export const FIELD_INSPECTION_SUBMITTED_EVENT = "field-inspection-submitted";

export const GOVERNMENT_REVIEW_SUBMITTED_EVENT = "government-review-submitted";

export const VALUATION_COORDINATION_SUBMITTED_EVENT =
  "valuation-coordination-submitted";

export function dispatchWorkflowSubmitted(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}
