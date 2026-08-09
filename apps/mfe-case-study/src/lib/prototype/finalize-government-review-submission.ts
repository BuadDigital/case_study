import type { GovernmentReviewSubmission } from "./government-review-work-data";
import { submitGovernmentReviewSubmission } from "./government-review-work-storage";

export type FinalizeGovernmentReviewResult =
  | { ok: true; data: GovernmentReviewSubmission }
  | { ok: false; error: string };

/** يُنهي المراجعة الحكومية ويُكمل مهمة الطرف (عبر API submit). */
export async function finalizeGovernmentReviewSubmission(
  taskId: string,
): Promise<FinalizeGovernmentReviewResult> {
  return submitGovernmentReviewSubmission(taskId);
}
