/**
 * Pure rules of «رفع تجميد الرفع المساحي» (batch 2C, wire (g)): who sees the lift, when, and what the
 * reason dialog needs. The failure stays open — only the engineering office's survey freeze is lifted.
 */
import type { RoleId } from "@platform/types";
import {
  isActiveFailureStatus,
  isSurveyFreezeLifted,
  type FailureRecord,
} from "@platform/app-shared/failures/failures-types";
import { canLiftSurveyFreeze } from "./po-roles";

export const SURVEY_FREEZE_LIFT_REASON_MIN_LENGTH = 10;

/** What the failure row shows: the lift button, the «lifted» line, or nothing. */
export type SurveyFreezeLiftView = "lift" | "lifted" | "none";

export function surveyFreezeLiftView(
  role: RoleId,
  failure: Pick<FailureRecord, "status" | "surveyFreezeLiftedAt">,
): SurveyFreezeLiftView {
  if (!isActiveFailureStatus(failure.status)) return "none";
  if (isSurveyFreezeLifted(failure)) return "lifted";
  return canLiftSurveyFreeze(role) ? "lift" : "none";
}

/** Reason rule — trimmed, at least 10 characters. Returns the Arabic error, or null when valid. */
export function surveyFreezeLiftReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "سبب رفع التجميد إلزامي.";
  if (trimmed.length < SURVEY_FREEZE_LIFT_REASON_MIN_LENGTH) {
    return `سبب رفع التجميد ${SURVEY_FREEZE_LIFT_REASON_MIN_LENGTH} أحرف على الأقل.`;
  }
  return null;
}

/** «رُفع التجميد بتاريخ … — السبب …» */
export function surveyFreezeLiftedText(
  failure: Pick<FailureRecord, "surveyFreezeLiftedAt" | "surveyFreezeLiftReason">,
  formatDate: (isoDay: string) => string,
): string {
  const day = failure.surveyFreezeLiftedAt?.trim().slice(0, 10) ?? "";
  const reason = failure.surveyFreezeLiftReason?.trim() ?? "";
  return [
    day ? `رُفع التجميد بتاريخ ${formatDate(day)}` : "رُفع التجميد",
    reason ? `السبب: ${reason}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}
