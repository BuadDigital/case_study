/**
 * Pure rules behind the basics screen's settings form (ApproachSettingsSection):
 * the ownership-interest options (D11), the retrospective rationale (D9) and the
 * client-side checks that mirror ValuationApproachSettingsRules.Validate so the
 * appraiser sees the field error before the server answers 400. No React, no I/O.
 */
import { parseLocaleNumber } from "@platform/app-shared/format/number";

/** Same bound as the backend's ValuationApproachSettingsRules.RetrospectiveRationaleMinLength. */
export const RETROSPECTIVE_RATIONALE_MIN_LENGTH = 10;
/** Same bound as the backend's OwnershipInterestKeys.MaxRemainingLeaseYears. */
export const MAX_REMAINING_LEASE_YEARS = 999;

export type OwnershipInterestKey = "freehold" | "usufruct" | "leased_land";

export const OWNERSHIP_INTEREST_OPTIONS: readonly {
  key: OwnershipInterestKey;
  labelAr: string;
}[] = [
  { key: "freehold", labelAr: "ملكية تامة" },
  { key: "usufruct", labelAr: "حق منفعة" },
  { key: "leased_land", labelAr: "أرض مستأجرة" },
];

/** Blank or unknown → freehold (the backend's OwnershipInterestKeys.Normalize). */
export function normalizeOwnershipInterestKey(
  value: string | null | undefined,
): OwnershipInterestKey {
  const v = (value ?? "").trim().toLowerCase();
  return OWNERSHIP_INTEREST_OPTIONS.some((o) => o.key === v)
    ? (v as OwnershipInterestKey)
    : "freehold";
}

/** «حق منفعة» / «أرض مستأجرة» carry the remaining lease term. */
export function isLeaseholdInterest(value: string | null | undefined): boolean {
  return normalizeOwnershipInterestKey(value) !== "freehold";
}

/** Typed lease years → number (Arabic digits accepted); null when blank or not a number. */
export function parseRemainingLeaseYears(text: string): number | null {
  const n = parseLocaleNumber(text.trim());
  return Number.isFinite(n) ? n : null;
}

export type ApproachSettingsDraft = {
  dateMode: string;
  retroKind: "single" | "range";
  retroDate: string;
  retroDateEnd: string;
  retroRationale: string;
  ownershipKey: string;
  leaseYearsText: string;
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
  if (isLeaseholdInterest(d.ownershipKey)) {
    const years = parseRemainingLeaseYears(d.leaseYearsText);
    if (years == null || years <= 0) {
      return {
        key: "remainingLeaseYears",
        message: "المدة المتبقية من حق المنفعة / عقد إيجار الأرض (بالسنوات) إلزامية",
      };
    }
    if (years > MAX_REMAINING_LEASE_YEARS) {
      return {
        key: "remainingLeaseYears",
        message: `المدة المتبقية لا تتجاوز ${MAX_REMAINING_LEASE_YEARS} سنة`,
      };
    }
  }
  return null;
}

/** The D9/D11 part of the save request built from the draft. */
export function approachSettingsDraftRequestFields(d: ApproachSettingsDraft): {
  retrospectiveRationale: string | null;
  ownershipInterestKey: OwnershipInterestKey;
  remainingLeaseYears: number | null;
} {
  const ownershipInterestKey = normalizeOwnershipInterestKey(d.ownershipKey);
  return {
    retrospectiveRationale:
      d.dateMode === "retrospective" ? d.retroRationale.trim() || null : null,
    ownershipInterestKey,
    remainingLeaseYears:
      ownershipInterestKey === "freehold"
        ? null
        : parseRemainingLeaseYears(d.leaseYearsText),
  };
}
