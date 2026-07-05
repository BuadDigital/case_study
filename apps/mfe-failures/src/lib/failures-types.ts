export type FailureStatus =
  | "internal"
  | "review"
  | "approved"
  | "returned"
  | "resolved"
  | "suspended";

/** احتمال تعذر — warning only; تعذر داخلي — stops work on the property. */
export type FailureSeverity = "suspected" | "internal";

export type FailureRecord = {
  id: string;
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  /** Display title — derived from problem type when present. */
  title: string;
  problemTypeId: string;
  severity: FailureSeverity;
  raisedByRole: string;
  internalNote: string;
  finalNote: string;
  resolutionReason: string;
  continueInstructions: string;
  status: FailureStatus;
  specialist: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateFailureInput = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  problemTypeId: string;
  severity: FailureSeverity;
  raisedByRole?: string;
  /** Optional override; defaults to catalog label for problemTypeId. */
  title?: string;
  internalNote?: string;
  specialist: string;
};

export type ResolveFailureInput = {
  resolutionReason: string;
  continueInstructions: string;
};

export type BourseObstructionInput = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  reason: string;
  specialist: string;
};

export function isActiveFailureStatus(status: FailureStatus): boolean {
  return status !== "resolved" && status !== "suspended";
}

/** Stops work and shows as an open obstruction (not yet cleared). */
export function isBlockingFailureStatus(status: FailureStatus): boolean {
  return (
    status === "internal" ||
    status === "review" ||
    status === "returned" ||
    status === "approved"
  );
}

/** Closed failures — show as «تعذرات سابقة», not as active blockers. */
export function isHistoricalFailureStatus(status: FailureStatus): boolean {
  return status === "resolved" || status === "suspended";
}

/** Open failures for sidebar badge and stats (not approved / resolved). */
export function countOpenFailures(records: FailureRecord[]): number {
  return records.filter(
    (f) =>
      isActiveFailureStatus(f.status) &&
      (f.status === "internal" ||
        f.status === "review" ||
        f.status === "returned"),
  ).length;
}
