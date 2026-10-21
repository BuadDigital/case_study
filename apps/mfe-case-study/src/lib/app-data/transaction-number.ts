/** The number a deed row shows for its transaction: the official PR reference first, then the D- draft number. */
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
