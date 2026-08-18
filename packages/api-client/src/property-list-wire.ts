/** Wire values for property-list Survey/Val/Study tracks and Status. */
export const PropertyListRowStatuses = {
  New: "new",
  Progress: "progress",
  Done: "done",
  Fail: "fail",
  Incomplete: "incomplete",
} as const;

export type PropertyListRowStatus =
  (typeof PropertyListRowStatuses)[keyof typeof PropertyListRowStatuses];

/** Wire values for property timeline event tone. */
export const PropertyTimelineTones = {
  Done: "done",
  Active: "active",
  Warn: "warn",
  Muted: "muted",
} as const;

export type PropertyTimelineTone =
  (typeof PropertyTimelineTones)[keyof typeof PropertyTimelineTones];

export function normalizePropertyTimelineTone(tone: string): PropertyTimelineTone {
  const value = tone.trim().toLowerCase();
  if (
    value === PropertyTimelineTones.Active ||
    value === PropertyTimelineTones.Warn ||
    value === PropertyTimelineTones.Muted
  ) {
    return value;
  }
  return PropertyTimelineTones.Done;
}

/** Wire values for financial summary revenue-row Status chips. */
export const FinancialRevenueRowStatuses = {
  Progress: "progress",
  Done: "done",
} as const;

export type FinancialRevenueRowStatus =
  (typeof FinancialRevenueRowStatuses)[keyof typeof FinancialRevenueRowStatuses];
