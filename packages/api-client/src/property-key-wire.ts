/** Gate + government-review payload keysStatus. */
export const PropertyKeysStatuses = {
  Pending: "pending",
  Received: "received",
  NotRequired: "not_required",
  Blocked: "blocked",
} as const;

/** Gate keyHandedToInspector. */
export const PropertyKeyHandedValues = {
  Yes: "yes",
  No: "no",
} as const;

/** Property-key gate source. */
export const PropertyKeyGateSources = {
  Envelope: "envelope",
  CourtAccess: "court_access",
  Legacy: "legacy",
  None: "none",
} as const;
