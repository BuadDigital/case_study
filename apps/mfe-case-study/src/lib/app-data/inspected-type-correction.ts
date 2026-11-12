/**
 * Case staff's change of a submitted inspection's property type and «استخدام العقار» (Omar
 * 2026-11-12: the study specialist changes the type too — until then only the inspector could, by a
 * return). The rules the dialog checks before it asks the server; the server
 * (`PartyTaskSubmissionService.CorrectInspectedTypeAsync`) is the judge.
 */
import type { CorrectInspectedTypeRequest } from "@platform/api-client";
import {
  ALL_PROPERTY_TYPES,
  propertyUsageValue,
  textLooksLikeVacantLand,
} from "@platform/app-shared/app-data/inspector-workspace-data";

/** A new type states why, in at least this many characters (server: `StaffChangeReasonMinLength`). */
export const INSPECTED_TYPE_REASON_MIN = 10;

export const INSPECTED_TYPE_REASON_REQUIRED =
  "اذكر سبب تعديل نوع العقار (10 أحرف على الأقل)";

export const INSPECTED_TYPE_REQUIRED = "اختر نوع العقار من القائمة";

type CorrectionField = "propertyType" | "propertyUsage" | "reason";

type CorrectionPlan =
  | { ok: true; request: CorrectInspectedTypeRequest | null }
  | { ok: false; field: CorrectionField; error: string };

/** The type changed (trimmed, exact) — only then is the reason asked. */
export function inspectedTypeChanged(currentType: string, nextType: string): boolean {
  return nextType.trim() !== "" && nextType.trim() !== currentType.trim();
}

/**
 * What «حفظ» of the dialog sends.
 *
 * How it works: a changed type must be on the system's list and carry a reason of 10 characters; a
 * changed usage needs none. Only what changed goes into the request.
 * Edge cases: nothing changed → `request: null` (the dialog just closes); an emptied usage is not a
 * change (the field cannot be cleared here); a usage holding an old classification reads as empty.
 */
export function planInspectedTypeCorrection(input: {
  currentType: string;
  currentUsage: string;
  nextType: string;
  nextUsage: string;
  reason: string;
}): CorrectionPlan {
  const nextType = input.nextType.trim();
  const typeChanged = inspectedTypeChanged(input.currentType, nextType);
  const nextUsage = propertyUsageValue(input.nextUsage);
  const usageChanged = nextUsage !== "" && nextUsage !== propertyUsageValue(input.currentUsage);
  const reason = input.reason.trim();

  if (typeChanged && !ALL_PROPERTY_TYPES.includes(nextType)) {
    return { ok: false, field: "propertyType", error: INSPECTED_TYPE_REQUIRED };
  }
  if (typeChanged && reason.length < INSPECTED_TYPE_REASON_MIN) {
    return { ok: false, field: "reason", error: INSPECTED_TYPE_REASON_REQUIRED };
  }
  if (!typeChanged && !usageChanged) return { ok: true, request: null };
  return {
    ok: true,
    request: {
      ...(typeChanged ? { propertyType: nextType, reason } : {}),
      ...(usageChanged ? { propertyUsage: nextUsage } : {}),
    },
  };
}

/**
 * What a change between land and a built type does to the inspector's answers, said before saving.
 *
 * How it works: to land — the building answers are hidden, not deleted, and come back with the type;
 * from land — they show again, and whatever the inspector never entered is missing.
 * Edge cases: no crossing (villa → building, residential land → commercial land) says nothing. The
 * screen cannot tell whether hidden answers are stored (a land's draft never carries them), so the
 * second note covers both an inspection done as land and a type changed to land and back.
 */
export function inspectedTypeCrossingNote(currentType: string, nextType: string): string | null {
  if (!inspectedTypeChanged(currentType, nextType)) return null;
  const wasLand = textLooksLikeVacantLand(currentType);
  const isLand = textLooksLikeVacantLand(nextType);
  if (wasLand === isLand) return null;
  return isLand
    ? "حقول المبنى التي أدخلها المعاين (الواجهة، حالة البناء، الإشغال…) تُخفى ولا تُحذف، وتعود إن رجع النوع."
    : "حقول المبنى (الواجهة، حالة البناء، الإشغال…) تظهر من جديد. ما لم يُدخله المعاين منها يُطلب عند تأكيد مدخلاته، وبعد التأكيد يُستكمل بإعادة المعاينة للمعاين.";
}

/** The server's refusal mapped onto the dialog's fields (its keys are the request's). */
export function mapInspectedTypeFieldErrors(
  errors: Record<string, string> | undefined,
): Partial<Record<CorrectionField, string>> {
  return {
    propertyType: errors?.propertyType,
    propertyUsage: errors?.propertyUsage,
    reason: errors?.reason,
  };
}
