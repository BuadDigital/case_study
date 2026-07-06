import type { GovernmentReviewSubmission } from "./government-review-work-data";
import { submitGovernmentReviewSubmission } from "./government-review-work-storage";

/** يُنهي المراجعة الحكومية ويُكمل مهمة الطرف (عبر API submit). */
export async function finalizeGovernmentReviewSubmission(
  taskId: string,
): Promise<GovernmentReviewSubmission | null> {
  const result = await submitGovernmentReviewSubmission(taskId);
  return result.ok ? result.data : null;
}
