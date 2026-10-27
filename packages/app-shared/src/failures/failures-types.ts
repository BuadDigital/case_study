export type FailureStatus =
  | "internal"
  | "review"
  | "approved"
  | "returned"
  | "resolved"
  | "suspended";

/** Possible failure — warning only; internal failure — stops work on the property. */
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
  /** «سبب التصعيد» — the specialist's explanation when escalating to the supervisor. */
  escalationNote?: string;
  finalNote: string;
  resolutionReason: string;
  continueInstructions: string;
  status: FailureStatus;
  specialist: string;
  createdAt: string;
  updatedAt: string;
  /** The specialist lifted the survey freeze this failure caused (the failure itself stays open). */
  surveyFreezeLiftedAt?: string | null;
  surveyFreezeLiftReason?: string | null;
  /** The deed's transaction number (PR-… or TMP-…), shown as «رقم المعاملة». */
  transactionNumber?: string | null;
  /** Deeds in that transaction (1 for an ordinary property). */
  transactionDeedCount?: number;
  /** «الأخصائي» — the company's case specialist on the deed; null until one is assigned. */
  caseSpecialistName?: string | null;
};

/** The survey freeze of this failure was lifted by the specialist. */
export function isSurveyFreezeLifted(
  failure: Pick<FailureRecord, "surveyFreezeLiftedAt">,
): boolean {
  return Boolean(failure.surveyFreezeLiftedAt?.trim());
}

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

/** Closed failures — show as «prior failures», not as active blockers. */
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
