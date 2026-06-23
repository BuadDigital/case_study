import type { GovernmentReviewSubmission } from "./government-review-work-data";

export type GovernmentReviewFieldErrors = Partial<
  Record<
    | "visitStatus"
    | "visitDate"
    | "keysStatus"
    | "keysDescription"
    | "accessBlockReason"
    | "confirmed"
    | "keysProofFiles",
    string
  >
>;

export function validateGovernmentReviewSubmission(
  submission: GovernmentReviewSubmission,
): GovernmentReviewFieldErrors {
  const errors: GovernmentReviewFieldErrors = {};

  if (!submission.visitStatus) {
    errors.visitStatus = "حدّد حالة زيارة المحكمة";
  }

  if (submission.visitStatus === "completed" && !submission.visitDate.trim()) {
    errors.visitDate = "أدخل تاريخ الزيارة";
  }

  if (
    submission.visitStatus === "blocked" &&
    !submission.accessBlockReason.trim()
  ) {
    errors.accessBlockReason = "اذكر سبب تعذر الوصول";
  }

  if (!submission.keysStatus) {
    errors.keysStatus = "حدّد حالة استلام المفاتيح";
  }

  if (
    submission.keysStatus === "received" &&
    !submission.keysDescription.trim()
  ) {
    errors.keysDescription = "صف المفاتيح المستلمة أو موقع حفظها";
  }

  if (
    submission.keysStatus === "received" &&
    submission.keysProofFiles.length === 0
  ) {
    errors.keysProofFiles = "ارفع إثبات استلام المفتاح (صورة أو خطاب)";
  }

  if (
    submission.keysStatus === "pending" &&
    submission.visitStatus === "completed" &&
    !submission.accessBlockReason.trim()
  ) {
    errors.accessBlockReason =
      "اذكر سبب عدم استلام المفاتيح أو الخطوة التالية";
  }

  if (!submission.confirmed) {
    errors.confirmed = "يجب تأكيد اكتمال المراجعة قبل الإرسال";
  }

  return errors;
}

export function firstGovernmentReviewError(
  errors: GovernmentReviewFieldErrors,
): string {
  return (
    errors.visitStatus ??
    errors.visitDate ??
    errors.keysStatus ??
    errors.keysDescription ??
    errors.keysProofFiles ??
    errors.accessBlockReason ??
    errors.confirmed ??
    "تحقق من الحقول المطلوبة"
  );
}
