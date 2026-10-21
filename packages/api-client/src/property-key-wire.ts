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

/** Who holds the key envelope now (decision 2026-10-20). */
export const KeyHolderKinds = {
  Reviewer: "reviewer",
  InternalUser: "internal_user",
  External: "external",
  Court: "court",
} as const;

/** Where a deed's matching key is after the field trial (decision 2026-10-20). */
export const KeyLocations = {
  InEnvelope: "in_envelope",
  WithUser: "with_user",
  ReturnedCourt: "returned_court",
  Missing: "missing",
} as const;
