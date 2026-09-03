import type { EngineeringSurveySubmissionStatus } from "./engineering-survey-data";

/**
 * Transaction is «active» for the engineering office = still in its turn (survey not yet sent).
 * After send it leaves the active turn and only recall is available.
 */
export function isEngineeringSurveyTransactionActive(
  taskStatus: string,
  submissionStatus: EngineeringSurveySubmissionStatus | null | undefined,
): boolean {
  if (taskStatus === "completed") return false;
  return submissionStatus !== "submitted";
}
