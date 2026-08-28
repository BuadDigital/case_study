const SEQ_STORAGE_PREFIX = "ejadah.valuation-report.yearly-seq.";

// ورشة الترقيم (بند البتّ 3): النمط الموحد TQ-{سنة}-{تسلسل ٥}. الأرقام المجمّدة
// في لقطات ق-6 الصادرة قبل التفعيل لا تتغير — هذه الصيغة لما يُصدر بعده فقط.
// يجب أن تبقى مطابقة لـ ValuationReportNumberRules في الخادم.
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

/** Allocates the next TQ number for the local calendar year (prototype sequence). */
export function allocateValuationReportNumber(issuedAt: Date = new Date()): string {
  const year = String(issuedAt.getFullYear());
  let next = 1;
  try {
    const raw = globalThis.localStorage?.getItem(SEQ_STORAGE_PREFIX + year);
    const parsed = Number.parseInt(raw ?? "0", 10);
    if (Number.isFinite(parsed) && parsed >= 0) next = parsed + 1;
    globalThis.localStorage?.setItem(SEQ_STORAGE_PREFIX + year, String(next));
  } catch {
    next = 1;
  }
  return formatValuationReportNumber(issuedAt, next);
}
