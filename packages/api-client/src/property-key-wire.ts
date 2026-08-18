/** Wire values for PropertyKeyRecord.workflowStatus / list Status. */
export const PropertyKeyWorkflowStatuses = {
  Progress: "progress",
  Done: "done",
} as const;

export type PropertyKeyWorkflowStatus =
  (typeof PropertyKeyWorkflowStatuses)[keyof typeof PropertyKeyWorkflowStatuses];

/** Gate + government-review payload keysStatus. */
export const PropertyKeysStatuses = {
  Pending: "pending",
  Received: "received",
  NotRequired: "not_required",
  Blocked: "blocked",
} as const;

export type PropertyKeysStatus =
  (typeof PropertyKeysStatuses)[keyof typeof PropertyKeysStatuses];

/** Gate keyHandedToInspector. */
export const PropertyKeyHandedValues = {
  Yes: "yes",
  No: "no",
} as const;

export type PropertyKeyHandedValue =
  (typeof PropertyKeyHandedValues)[keyof typeof PropertyKeyHandedValues];

/** Property-key gate source. */
export const PropertyKeyGateSources = {
  Envelope: "envelope",
  CourtAccess: "court_access",
  Legacy: "legacy",
  None: "none",
} as const;

export type PropertyKeyGateSource =
  (typeof PropertyKeyGateSources)[keyof typeof PropertyKeyGateSources];
