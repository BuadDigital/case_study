/**
 * Pure fee rules shared by the parallel fee screens (`EngFeesHtmlScreen`,
 * `PartyIndividualFeesHtmlScreen`): deed label parsing, the statement pill and
 * the two list searches. Each screen's own state file keeps its status buckets.
 */
import type { StatusPillStyle } from "@platform/ui-kit";
import type {
  InspectorFeeRowDto,
  PartyBillingStatementDto,
} from "@platform/api-client";

export function deedParts(row: InspectorFeeRowDto): { deed: string; region: string } {
  const label = (row.propertyLabel || "").trim();
  const sep = label.includes("—")
    ? "—"
    : label.includes("–")
      ? "–"
      : label.includes(" - ")
        ? " - "
        : null;
  if (sep) {
    const [a, ...rest] = label.split(sep);
    return {
      deed: a.trim() || label,
      region: rest.join(sep).trim() || row.poNumber || "—",
    };
  }
  return { deed: label || "—", region: row.poNumber || "—" };
}

/** Deed / region / PO text search over one fee row (`q` already trimmed + lower-cased). */
export function feeRowMatchesSearch(row: InspectorFeeRowDto, q: string): boolean {
  if (!q) return true;
  const { deed, region } = deedParts(row);
  return `${deed} ${region} ${row.poNumber}`.toLowerCase().includes(q);
}

/** Statement pill — `closedLabel` is the screen's word for a closed statement. */
export function feeStatementMeta(
  s: PartyBillingStatementDto,
  closedLabel: string,
): {
  label: string;
  style: StatusPillStyle;
} {
  if (s.status === "closed") {
    return {
      label: s.statusLabel || closedLabel,
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    };
  }
  if (s.status === "issued" || s.status === "invoice_received") {
    return {
      label: s.statusLabel || "صادر",
      style: { base: "#22406e", fg: "#102B4E" },
    };
  }
  return {
    label: s.statusLabel || "مسودة",
    style: { base: "#6b7c8f", fg: "#4a5568" },
  };
}

/** Statement search — reference number or any line's property label. */
export function filterFeeStatements(
  statements: PartyBillingStatementDto[],
  search: string,
): PartyBillingStatementDto[] {
  const q = search.trim().toLowerCase();
  if (!q) return statements;
  return statements.filter(
    (s) =>
      s.referenceNumber.toLowerCase().includes(q) ||
      s.lines.some((l) => (l.propertyLabel || "").toLowerCase().includes(q)),
  );
}
