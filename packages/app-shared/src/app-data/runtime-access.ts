/** Server-synced capabilities for prototype helpers (set after GET /api/permissions). */
let runtimeCapabilities: readonly string[] = [];

export function setRuntimeCapabilities(capabilities: readonly string[]): void {
  runtimeCapabilities = capabilities;
}

export function hasRuntimeCapability(capability: string): boolean {
  return runtimeCapabilities.includes(capability);
}

function hasAny(capabilities: readonly string[], wanted: readonly string[]): boolean {
  return wanted.some((c) => capabilities.includes(c));
}

/*
 * Read gates mirroring the API policies in Shared.Web ServiceCollectionExtensions.
 * A screen or prefetch that skips them asks for data the server refuses (403) —
 * the finance officer's dashboard used to load work orders it may not read.
 */

/** `read-case-study-workspace`: work orders, workflow tasks, PO details. */
export function canReadCaseStudyWorkspace(
  capabilities: readonly string[] = runtimeCapabilities,
): boolean {
  return hasAny(capabilities, ["manage-work-orders", "submit-party-work"]);
}

/** `list-distribution-assignees`: the staff picker for distribution and key handoffs. */
export function canListDistributionAssignees(
  capabilities: readonly string[] = runtimeCapabilities,
): boolean {
  return hasAny(capabilities, [
    "manage-work-orders",
    "manage-operations",
    "submit-valuation-report",
  ]);
}

/** `manage-work-orders`: case-staff queues such as the pending-bourse list. */
export function canManageWorkOrders(
  capabilities: readonly string[] = runtimeCapabilities,
): boolean {
  return capabilities.includes("manage-work-orders");
}

/** `manage-failures`: the suspended-transactions list. */
export function canManageFailures(
  capabilities: readonly string[] = runtimeCapabilities,
): boolean {
  return capabilities.includes("manage-failures");
}
