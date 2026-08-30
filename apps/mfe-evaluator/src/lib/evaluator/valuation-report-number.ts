// Numbering workshop (decision item 3): unified pattern TQ-{year}-{5-digit sequence}. Frozen numbers
// in Q-6 snapshots issued before rollout do not change — this format is for issues after only.
// Must stay aligned with ValuationReportNumberRules on the server.

/** In-process fallback only — never persist yearly sequences in localStorage. */
const sessionYearlySeq = new Map<string, number>();

export function formatValuationReportNumber(
  issuedAt: Date,
  ordinal: number,
): string {
  const n = Number.isFinite(ordinal) && ordinal >= 1 ? Math.floor(ordinal) : 1;
  return `TQ-${issuedAt.getFullYear()}-${String(n).padStart(5, "0")}`;
}

export function formatValuationReportIssueDateIso(issuedAt: Date = new Date()): string {
  return issuedAt.toISOString().slice(0, 10);
}

/** Number reserved at distribution: TQ + request year + digits from VR-####. */
export function reservedValuationReportNumber(
  displayId: string,
  requestDate: string,
): string {
  const digits = (displayId ?? "").replace(/\D/g, "");
  const parsed = Number.parseInt(digits, 10);
  const ordinal = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const trimmed = requestDate.trim();
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  const issuedAt = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date();
  return formatValuationReportNumber(issuedAt, ordinal);
}

/**
 * Last-resort session ordinal when the valuation API is unreachable.
 * Prefer `reservedValuationReportNumber` / server-reserved VR ids in production paths.
 */
export function allocateValuationReportNumber(issuedAt: Date = new Date()): string {
  const year = String(issuedAt.getFullYear());
  const next = (sessionYearlySeq.get(year) ?? 0) + 1;
  sessionYearlySeq.set(year, next);
  return formatValuationReportNumber(issuedAt, next);
}
