/**
 * Enfaz work-order invoice status — one label/tone source for the finance billing screen
 * and the supervisor tracking table. Mirrors PoEnfazInvoiceStatus on the server.
 * Only called once an invoice number exists, so an unknown status still reads "مُفوتَرة".
 */

const ENFAZ_INVOICE_STATUSES = [
  "issued",
  "partially_collected",
  "collected",
] as const;

type EnfazInvoiceStatus = (typeof ENFAZ_INVOICE_STATUSES)[number];

export type EnfazInvoiceStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "default";

const LABELS: Record<EnfazInvoiceStatus, string> = {
  issued: "صادرة",
  partially_collected: "تحصيل جزئي",
  collected: "محصّلة",
};

const TONES: Record<EnfazInvoiceStatus, EnfazInvoiceStatusTone> = {
  issued: "info",
  partially_collected: "warning",
  collected: "success",
};

function knownStatus(
  status: string | null | undefined,
): EnfazInvoiceStatus | null {
  return status && (ENFAZ_INVOICE_STATUSES as readonly string[]).includes(status)
    ? (status as EnfazInvoiceStatus)
    : null;
}

export function enfazInvoiceStatusLabel(status: string | null | undefined): string {
  const known = knownStatus(status);
  return known ? LABELS[known] : "مُفوتَرة";
}

/** Overdue wins over the collection state. */
export function enfazInvoiceStatusTone(
  status: string | null | undefined,
  isOverdue: boolean,
): EnfazInvoiceStatusTone {
  if (isOverdue) return "danger";
  const known = knownStatus(status);
  return known ? TONES[known] : "default";
}
