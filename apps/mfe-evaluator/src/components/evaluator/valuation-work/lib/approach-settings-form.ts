// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • New file — pure rules of the settings form. approachSettingsDraftError mirrors the server's
//         ValuationApproachSettingsRules: retrospective date / period checks and a rationale of at least
//         10 characters.
//  • Ownership options «ملكية تامة» / «حق منفعة» / «أرض مستأجرة» (normalizeOwnershipInterestKey) and
//         remaining lease years required for a leasehold, 1–999, Arabic digits accepted (parseLocaleNumber).
//  • approachSettingsDraftRequestFields builds the part of the save request.
// 2026-11-15 (Omar)
//  • The ownership options and the lease years are removed — the ownership type comes from the initial
//         data (the «مشاع» tick beside the owner name), not from this form.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pure rules behind the basics screen's settings form (ApproachSettingsSection):
 * the retrospective rationale and the client-side checks that mirror
 * ValuationApproachSettingsRules.Validate so the appraiser sees the field error
 * before the server answers 400. No React, no I/O.
 */

/** Same bound as the backend's ValuationApproachSettingsRules.RetrospectiveRationaleMinLength. */
export const RETROSPECTIVE_RATIONALE_MIN_LENGTH = 10;

export type ApproachSettingsDraft = {
  dateMode: string;
  retroKind: "single" | "range";
  retroDate: string;
  retroDateEnd: string;
  retroRationale: string;
};

export type ApproachSettingsDraftError = { key: string; message: string };

/** First client-side problem in the draft (document order), or null when it can be sent. */
export function approachSettingsDraftError(
  d: ApproachSettingsDraft,
): ApproachSettingsDraftError | null {
  if (d.dateMode === "retrospective") {
    if (!d.retroDate.trim()) {
      return { key: "retrospectiveDate", message: "تاريخ الأثر الرجعي إلزامي" };
    }
    if (d.retroKind === "range") {
      if (!d.retroDateEnd.trim()) {
        return { key: "retrospectiveDateEnd", message: "حدّد تاريخ نهاية الفترة" };
      }
      if (d.retroDateEnd < d.retroDate) {
        return {
          key: "retrospectiveDateEnd",
          message: "تاريخ النهاية يجب ألا يسبق تاريخ البداية",
        };
      }
    }
    if (d.retroRationale.trim().length < RETROSPECTIVE_RATIONALE_MIN_LENGTH) {
      return {
        key: "retrospectiveRationale",
        message: `مبرر التقييم بأثر رجعي إلزامي (${RETROSPECTIVE_RATIONALE_MIN_LENGTH} أحرف على الأقل)`,
      };
    }
  }
  return null;
}

/** The part of the save request built from the draft. */
export function approachSettingsDraftRequestFields(d: ApproachSettingsDraft): {
  retrospectiveRationale: string | null;
} {
  return {
    retrospectiveRationale:
      d.dateMode === "retrospective" ? d.retroRationale.trim() || null : null,
  };
}
