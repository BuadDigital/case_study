import type { GovernmentReviewSubmission } from "./government-review-work-data";
import {
  canFinalizeGovernmentReviewWithGate,
  isGovernmentReviewAwaitingKeyHandoff,
  isGovernmentReviewAwaitingVisit,
  mergeGovernmentReviewWithKeyGate,
  type GovernmentReviewKeyGateOverlay,
} from "./government-review-work-data";
import {
  governmentReviewSubmitFieldErrors,
} from "./documentary-workflow-gates";
import type { RoleId } from "@platform/types";

export type GovernmentReviewFieldErrors = Partial<
  Record<
    | "visitStatus"
    | "visitDate"
    | "keysStatus"
    | "keysDescription"
    | "keyHandedToInspector"
    | "accessBlockReason"
    | "confirmed"
    | "keysProofFiles",
    string
  >
>;

function validateKeysAndVisitBasics(
  submission: GovernmentReviewSubmission,
  errors: GovernmentReviewFieldErrors,
): void {
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
}

export function validateGovernmentReviewSubmission(
  submission: GovernmentReviewSubmission,
  documentary?: {
    role: RoleId;
    deedNumber?: string | null;
    requestNumber?: string | null;
    city?: string | null;
    district?: string | null;
    circuit?: string | null;
    poNumber?: string | null;
    assignmentMandateNumber?: string | null;
    assignmentMandateDate?: string | null;
  },
  gate?: GovernmentReviewKeyGateOverlay | null,
): GovernmentReviewFieldErrors & Record<string, string> {
  const errors: GovernmentReviewFieldErrors & Record<string, string> = {};
  const merged = mergeGovernmentReviewWithKeyGate(submission, gate);

  if (!submission.visitStatus) {
    errors.visitStatus = "حدّد حالة زيارة المحكمة";
  }

  if (!canFinalizeGovernmentReviewWithGate(submission, gate)) {
    if (submission.visitStatus !== "completed") {
      errors.visitStatus =
        "لا يمكن إتمام المراجعة قبل تأكيد «تمت الزيارة» — احفظ كمسودة بالانتظار";
    } else if (merged.keysStatus === "not_required") {
      errors.keysStatus = "حدّد حالة المفاتيح";
    } else if (merged.keyHandedToInspector !== "yes") {
      errors.keyHandedToInspector =
        "لإتمام المعاملة اختر «نعم» بعد تسليم المفتاح للمعاين — أو احفظ كقيد التنفيذ (أو اختر مفاتيح غير مطلوبة)";
    }
    return errors;
  }

  validateKeysAndVisitBasics(submission, errors);

  if (!submission.confirmed) {
    errors.confirmed = "يجب تأكيد اكتمال المراجعة قبل الإرسال";
  }

  if (documentary) {
    Object.assign(errors, governmentReviewSubmitFieldErrors(documentary));
  }

  return errors;
}

/** Minimal checks when saving a visit as «بالانتظار» (scheduled / blocked). */
export function validateGovernmentReviewPendingSave(
  submission: GovernmentReviewSubmission,
): GovernmentReviewFieldErrors {
  const errors: GovernmentReviewFieldErrors = {};

  if (!submission.visitStatus) {
    errors.visitStatus = "حدّد حالة زيارة المحكمة";
    return errors;
  }

  if (!isGovernmentReviewAwaitingVisit(submission.visitStatus)) {
    errors.visitStatus =
      "للإتمام اختر «تمت الزيارة» — أو احفظ كمسودة بالانتظار";
    return errors;
  }

  if (!submission.keysStatus) {
    errors.keysStatus = "حدّد حالة استلام المفاتيح";
  }

  if (
    submission.visitStatus === "blocked" &&
    !submission.accessBlockReason.trim()
  ) {
    errors.accessBlockReason = "اذكر سبب تعذر الوصول";
  }

  return errors;
}

/** Visit done but key not handed — keep transaction in progress. */
export function validateGovernmentReviewKeyHandoffPendingSave(
  submission: GovernmentReviewSubmission,
): GovernmentReviewFieldErrors {
  const errors: GovernmentReviewFieldErrors = {};

  if (!isGovernmentReviewAwaitingKeyHandoff(submission)) {
    errors.keyHandedToInspector =
      "اختر «لا» لحفظ المعاملة قيد التنفيذ حتى تسليم المفتاح";
    return errors;
  }

  validateKeysAndVisitBasics(submission, errors);
  return errors;
}

const DOCUMENTARY_ERROR_KEYS = [
  "deedNumber",
  "requestNumber",
  "city",
  "district",
  "circuit",
  "poNumber",
  "assignmentMandateNumber",
  "assignmentMandateDate",
] as const;

export function firstGovernmentReviewError(
  errors: GovernmentReviewFieldErrors & Record<string, string>,
): string {
  return (
    errors.visitStatus ??
    errors.visitDate ??
    errors.keysStatus ??
    errors.keysDescription ??
    errors.keysProofFiles ??
    errors.keyHandedToInspector ??
    errors.accessBlockReason ??
    errors.confirmed ??
    DOCUMENTARY_ERROR_KEYS.map((key) => errors[key]).find(Boolean) ??
    Object.values(errors).find(Boolean) ??
    "تحقق من الحقول المطلوبة"
  );
}

export function listGovernmentReviewDocumentaryErrors(
  errors: Record<string, string>,
): string[] {
  return DOCUMENTARY_ERROR_KEYS.map((key) => errors[key]).filter(
    (msg): msg is string => Boolean(msg),
  );
}
