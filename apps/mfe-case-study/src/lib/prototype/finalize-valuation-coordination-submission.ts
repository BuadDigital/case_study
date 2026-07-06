import type { ValuationCoordinationSubmission } from "./valuation-coordination-work-data";
import {
  saveValuationCoordinationSubmission,
  submitValuationCoordinationSubmission,
} from "./valuation-coordination-work-storage";

export type FinalizeValuationCoordinationResult = {
  submission: ValuationCoordinationSubmission;
  warning?: string;
};

/** يُنهي استلام منسق التقييم عبر PartyTaskSubmissions — الخادم يُكمل مهمة الطرف. */
export async function finalizeValuationCoordinationSubmission(
  taskId: string,
  draft?: ValuationCoordinationSubmission,
): Promise<FinalizeValuationCoordinationResult | null> {
  let warning: string | undefined;
  if (draft) {
    try {
      await saveValuationCoordinationSubmission(draft);
    } catch (err: unknown) {
      warning =
        err instanceof Error
          ? err.message
          : "تعذّر حفظ مسودة التنسيق قبل الإرسال";
    }
  }

  const submitted = await submitValuationCoordinationSubmission(taskId);
  if (!submitted.ok) return null;

  return warning
    ? { submission: submitted.data, warning }
    : { submission: submitted.data };
}
