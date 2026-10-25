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
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { feeRowMatchesSearch, feeStatementMeta } from "./fee-screen-state";

export {
  deedParts,
  filterFeeStatements as filterEngStatements,
} from "./fee-screen-state";

export type TabId = "action" | "ready" | "statements";

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
  return feeStatementMeta(s, "مصروف");
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
    return feeRowMatchesSearch(row, q);
  });
}
