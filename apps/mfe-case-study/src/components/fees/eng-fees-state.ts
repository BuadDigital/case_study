/**
 * Pure fee rules behind `EngFeesHtmlScreen`: status/statement pill meta, deed
 * label parsing, tab counts and the list filters. No React, no queries — the
 * screen keeps JSX and `useEngFeesWorkflow` keeps the writes.
 */
import type { StatusPillStyle } from "@platform/ui-kit";
import type {
  InspectorFeeRowDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { fmtMax } from "@platform/app-shared/format/number";
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";

export type TabId = "action" | "ready" | "statements";

export function fmtSar(n: number): string {
  return `${fmtMax(n || 0, 3)} ر.س`;
}


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
    return { deed: a.trim() || label, region: rest.join(sep).trim() || row.poNumber || "—" };
  }
  return { deed: label || "—", region: row.poNumber || "—" };
}

export function statusMeta(st: ReturnType<typeof engFeeUiStatus>): {
  label: string;
  style: StatusPillStyle;
} {
  const map: Record<string, { label: string; style: StatusPillStyle }> = {
    pending_office: {
      label: "بانتظار إفادتكم",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    dispute: {
      label: "تحفّظ على التسعير",
      style: { base: "#d9694f", fg: "#a5432e" },
    },
    carried: {
      label: "مرحَّل — متأخر عن دورته",
      style: { base: "#8a5e14", fg: "#8a5e14" },
    },
    ready: {
      label: "جاهز للفوترة",
      style: { base: "var(--ink)", fg: "var(--ink)" },
    },
    listed: {
      label: "مدرج في كشف",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    paid: {
      label: "مفوترة / مدفوعة",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    },
  };
  return map[st] ?? { label: "—", style: { base: "#6b7c8f", fg: "#4a5568" } };
}

export function statementMeta(s: PartyBillingStatementDto): {
  label: string;
  style: StatusPillStyle;
} {
  if (s.status === "closed") {
    return {
      label: s.statusLabel || "مصروف",
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


/** Tab badge counts — action lane vs. ready-to-bill lane. */
export function engFeeTabCounts(rows: InspectorFeeRowDto[]): {
  actionCount: number;
  readyCount: number;
} {
  let actionCount = 0;
  let readyCount = 0;
  for (const r of rows) {
    const st = engFeeUiStatus(r);
    if (st === "pending_office" || st === "dispute") actionCount += 1;
    if (st === "ready" || st === "carried") readyCount += 1;
  }
  return { actionCount, readyCount };
}

/** Active tab bucket, then the status dropdown and the deed/region/PO search. */
export function filterEngFeeRows(
  rows: InspectorFeeRowDto[],
  tab: TabId,
  search: string,
  stFilter: string,
): InspectorFeeRowDto[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    const st = engFeeUiStatus(row);
    const inTab =
      tab === "action"
        ? st === "pending_office" || st === "dispute"
        : st === "ready" || st === "carried";
    if (!inTab) return false;
    if (stFilter && st !== stFilter) return false;
    if (!q) return true;
    const { deed, region } = deedParts(row);
    return `${deed} ${region} ${row.poNumber}`.toLowerCase().includes(q);
  });
}

/** Statement search — reference number or any line's property label. */
export function filterEngStatements(
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
