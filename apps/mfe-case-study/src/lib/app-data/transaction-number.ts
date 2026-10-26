/**
 * The number a deed row shows for its transaction: the official PR reference first, then the
 * TMP- temporary number (numbering decision 2026-10-19/20; TMP replaced D).
 *
 * How it works: returns the trimmed `referenceNumber` when set, else the trimmed
 * `transactionDraftNumber`, else null.
 *
 * Edge cases: no property, or a deed with no transaction yet (older rows) → null; the queue
 * callers then fall back to the task's own `transactionNumber`.
 */
export function transactionNumberOf(
  property:
    | { referenceNumber?: string | null; transactionDraftNumber?: string | null }
    | null
    | undefined,
): string | null {
  const official = property?.referenceNumber?.trim();
  if (official) return official;
  const draft = property?.transactionDraftNumber?.trim();
  return draft || null;
}
