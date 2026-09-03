/** Fired only after an explicit user submit action (e.g. save and send survey). */
export const ENGINEERING_SURVEY_SUBMITTED_EVENT = "engineering-survey-submitted";

/** Specialist returned survey outputs for correction. */
export const ENGINEERING_SURVEY_RETURNED_EVENT = "engineering-survey-returned";

/** Specialist accepted survey outputs (fee accrual). */
export const ENGINEERING_SURVEY_ACCEPTED_EVENT = "engineering-survey-accepted";

/** Fired only after the appraiser submits their report. */
export const EVALUATOR_SUBMITTED_EVENT = "evaluator-submitted";

export function dispatchWorkflowSubmitted(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}
