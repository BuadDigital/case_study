/**
 * Report cells that come from «البيانات الأولية». When empty (—), mark them
 * like PO form errors so the appraiser can jump to the gap in the preview.
 */

import { normLabel } from "./valuation-report-fill-model";

export type ReportMissingIntakeField = {
  /** Arabic label as it appears on the report sheet (`td.k`). */
  label: string;
  /** Stable DOM id on the value cell for scroll/pulse. */
  targetId: string;
  /** Stable key for notification dedupe. */
  fieldKey: string;
  /** Where the appraiser should fix it. */
  source: string;
};

/** Ordered like section 02 — first empty wins for auto-scroll. */
export const REPORT_INTAKE_MISSING_FIELDS: readonly ReportMissingIntakeField[] = [
  {
    label: "رقم الطلب",
    targetId: "rpt-field-request-number",
    fieldKey: "requestNumber",
    source: "البيانات الأولية",
  },
  {
    label: "اسم المالك",
    targetId: "rpt-field-owner-name",
    fieldKey: "ownerName",
    source: "البيانات الأولية",
  },
  {
    label: "تاريخ الطلب",
    targetId: "rpt-field-request-date",
    fieldKey: "requestDate",
    source: "البيانات الأولية",
  },
];

export type ReportMissingIntakeLink = ReportMissingIntakeField & {
  message: string;
};

function isEmptyReportValue(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  return !t || t === "—";
}

/** Jump-link rows from fill cells (no DOM) — same rules as the red marks on the sheet. */
export function reportMissingIntakeLinksFromCells(
  cells: Record<string, string>,
): ReportMissingIntakeLink[] {
  const byLabel = new Map(
    Object.entries(cells).map(([k, v]) => [normLabel(k), v]),
  );
  const links: ReportMissingIntakeLink[] = [];
  for (const field of REPORT_INTAKE_MISSING_FIELDS) {
    if (!isEmptyReportValue(byLabel.get(normLabel(field.label)))) continue;
    links.push({
      ...field,
      message: `${field.label} ناقص — يُستكمل من ${field.source}`,
    });
  }
  return links;
}

/** Mark empty intake value cells and return jump links for the banner. */
export function markReportMissingIntakeFields(
  root: ParentNode,
  cells: Record<string, string>,
): ReportMissingIntakeLink[] {
  const links = reportMissingIntakeLinksFromCells(cells);

  for (const field of links) {
    const labelCell = [...root.querySelectorAll("td.k")].find(
      (td) => normLabel(td.textContent ?? "") === normLabel(field.label),
    );
    const valueCell = labelCell?.nextElementSibling;
    if (
      !(valueCell instanceof HTMLElement) ||
      !(
        valueCell.classList.contains("v") || valueCell.classList.contains("num")
      )
    ) {
      continue;
    }

    valueCell.id = field.targetId;
    valueCell.setAttribute("data-rpt-missing", "1");
    valueCell.setAttribute("data-rpt-missing-source", field.source);
    valueCell.setAttribute(
      "title",
      `ناقص — يُستكمل من ${field.source}`,
    );
  }

  return links;
}
