const SEQ_STORAGE_PREFIX = "ejadah.valuation-report.daily-seq.";

export function formatValuationReportYmd(issuedAt: Date): string {
  const year = issuedAt.getFullYear();
  const month = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const day = String(issuedAt.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Preliminary issued number: TQ + yyyyMMdd + 4-digit daily ordinal. */
export function formatValuationReportNumber(
  issuedAt: Date,
  dailyOrdinal: number,
): string {
  const ordinal = Number.isFinite(dailyOrdinal) && dailyOrdinal >= 1
    ? Math.floor(dailyOrdinal)
    : 1;
  return `TQ${formatValuationReportYmd(issuedAt)}${String(ordinal).padStart(4, "0")}`;
}

export function formatValuationReportIssueDateIso(issuedAt: Date = new Date()): string {
  return issuedAt.toISOString().slice(0, 10);
}

/** Number reserved at distribution: TQ + request date + digits from VR-####. */
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

/** Allocates the next TQ number for the local calendar day (prototype sequence). */
export function allocateValuationReportNumber(issuedAt: Date = new Date()): string {
  const ymd = formatValuationReportYmd(issuedAt);
  let next = 1;
  try {
    const raw = globalThis.localStorage?.getItem(SEQ_STORAGE_PREFIX + ymd);
    const parsed = Number.parseInt(raw ?? "0", 10);
    if (Number.isFinite(parsed) && parsed >= 0) next = parsed + 1;
    globalThis.localStorage?.setItem(SEQ_STORAGE_PREFIX + ymd, String(next));
  } catch {
    next = 1;
  }
  return formatValuationReportNumber(issuedAt, next);
}
