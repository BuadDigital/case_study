/**
 * Reading the field errors `POST /api/case-study-reports/{taskId}/issue` and `.../reopen` answer
 * with. Pure — the commands and the form hook both build on it.
 */

/** Server-side issue refusal, split into what the form can highlight. */
export type CaseStudyIssueErrors = {
  /** `missingQuestionKeys` (comma-separated) as a set of question keys. */
  missingQuestionKeys: Set<string>;
  /** `answers` — «أسئلة ناقصة: N من M». */
  answersMessage?: string;
  /** The deed-nature outcome was refused (`deedNatureMatchOutcome`). */
  deedNature: boolean;
  /** The deed-nature notes were refused (`deedNatureMatchNotes`). */
  deedNatureNotes: boolean;
  /** The deed remarks were refused (`deedRemarks`). */
  deedRemarks: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Splits a comma-separated `missingQuestionKeys` value, dropping blanks and repeats. */
export function parseMissingQuestionKeys(raw: unknown): Set<string> {
  const keys = new Set<string>();
  for (const part of text(raw).split(",")) {
    const key = part.trim();
    if (key) keys.add(key);
  }
  return keys;
}

export function parseCaseStudyIssueErrors(
  errors: Record<string, unknown> | undefined,
): CaseStudyIssueErrors {
  return {
    missingQuestionKeys: parseMissingQuestionKeys(errors?.missingQuestionKeys),
    answersMessage: text(errors?.answers) || undefined,
    deedNature: Boolean(text(errors?.deedNatureMatchOutcome)),
    deedNatureNotes: Boolean(text(errors?.deedNatureMatchNotes)),
    deedRemarks: Boolean(text(errors?.deedRemarks)),
  };
}

/** Reopen refusal: the property was handed over to Enfaz and the clear was not confirmed. */
export function reopenNeedsEnfazConfirmation(
  errors: Record<string, unknown> | undefined,
): boolean {
  return Boolean(text(errors?.enfazHandover));
}

export const CASE_STUDY_REOPEN_REASON_MIN_LENGTH = 10;

/** Reopen reason rule — trimmed, at least 10 characters. Returns the Arabic error, or null when valid. */
export function caseStudyReopenReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "سبب إعادة الفتح إلزامي.";
  if (trimmed.length < CASE_STUDY_REOPEN_REASON_MIN_LENGTH) {
    return `سبب إعادة الفتح ${CASE_STUDY_REOPEN_REASON_MIN_LENGTH} أحرف على الأقل.`;
  }
  return null;
}

/** What a reopen attempt answers the dialog with. */
export type CaseStudyReopenOutcome =
  | { ok: true }
  | { ok: false; error: string; needsEnfazConfirmation: boolean };

export type CaseStudyReopenSubmitPlan =
  | { ok: false; field: "reason" | "enfaz"; error: string }
  | { ok: true; reason: string; clearEnfazHandover: boolean };

/**
 * What the reopen dialog submits. The first attempt never clears the Enfaz handover; once the server
 * answered `enfazHandover` the checkbox appears (`enfazPrompted`) and the retry must carry the
 * user's explicit confirmation (`clearEnfazHandover: true`).
 */
export function planCaseStudyReopenSubmit(args: {
  reason: string;
  enfazPrompted: boolean;
  enfazConfirmed: boolean;
}): CaseStudyReopenSubmitPlan {
  const reasonError = caseStudyReopenReasonError(args.reason);
  if (reasonError) return { ok: false, field: "reason", error: reasonError };
  if (args.enfazPrompted && !args.enfazConfirmed) {
    return {
      ok: false,
      field: "enfaz",
      error: "أكّد إلغاء تسليم إنفاذ للمتابعة، أو ألغِ إعادة الفتح.",
    };
  }
  return {
    ok: true,
    reason: args.reason.trim(),
    clearEnfazHandover: args.enfazPrompted && args.enfazConfirmed,
  };
}

/** Success toast of a reopen — warns when the appraiser's submission closes again. */
export function caseStudyReopenSuccessMessage(appraiserSubmitted: boolean): string {
  return appraiserSubmitted
    ? "أُعيد فتح التقرير — المقيّم سلّم تقييمه وسيُغلق تسليمه من جديد حتى تُصدر التقرير"
    : "أُعيد فتح تقرير دراسة الحالة";
}
