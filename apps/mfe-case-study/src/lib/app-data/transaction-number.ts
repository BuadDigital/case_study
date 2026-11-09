/**
 * The number a deed row shows: «رقم المعاملة», the deed's own PR number (ruling 2026-11-08).
 *
 * How it works: returns the trimmed `referenceNumber` (the deed's number) when set, else the trimmed
 * `transactionReferenceNumber` (its property's number — only an old row without its own), else null.
 *
 * Edge cases: a slot still waiting for its initial data has no number → null, and the queue callers
 * then fall back to the task's own `transactionNumber`; the retired TMP number is never shown.
 */
export function transactionNumberOf(
  property:
    | { referenceNumber?: string | null; transactionReferenceNumber?: string | null }
    | null
    | undefined,
): string | null {
  const own = property?.referenceNumber?.trim();
  if (own) return own;
  return property?.transactionReferenceNumber?.trim() || null;
}
