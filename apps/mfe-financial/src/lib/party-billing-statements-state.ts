/**
 * Pure rules behind `FinancePartyBillingStatements` — which dues and which
 * statements each mode shows, the dues search/sort and the selection total.
 * No React, no I/O.
 */
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";

import { daysSinceIsoCost } from "./finance-cost-parties";

export type PartyBillingMode = "all" | "dues" | "statements" | "paid";

/** Dues and statements are scoped to one payee account when an assignee is set. */
export function duesForAssignee(
  lines: PartyBillingReadyLineDto[],
  assigneeId: string | null | undefined,
): PartyBillingReadyLineDto[] {
  const key = assigneeId?.trim();
  if (!key) return lines;
  return lines.filter((l) => (l.assigneeId?.trim() || "—") === key);
}

export function statementsForAssignee(
  statements: PartyBillingStatementDto[],
  assigneeId: string | null | undefined,
): PartyBillingStatementDto[] {
  const key = assigneeId?.trim();
  if (!key) return statements;
  return statements.filter((s) => (s.assigneeId?.trim() || "") === key);
}

/** Statement list per screen mode — “dues” shows none, “paid” only closed. */
export function statementsForMode(
  statements: PartyBillingStatementDto[],
  mode: PartyBillingMode,
): PartyBillingStatementDto[] {
  if (mode === "paid") return statements.filter((s) => s.status === "closed");
  if (mode === "statements")
    return statements.filter(
      (s) =>
        s.status === "draft" ||
        s.status === "issued" ||
        s.status === "invoice_received" ||
        s.status === "cancelled",
    );
  if (mode === "dues") return [];
  return statements;
}

/**
 * The server-side form of `statementsForMode`: the CSV `status` filter one
 * mode sends on `GET /api/party-billing-statements` (pagination-contract
 * §9.1). `undefined` means "no status filter" (the “all” overview); “dues”
 * shows no statements at all, so its query is disabled rather than filtered.
 */
export function statementStatusesForMode(
  mode: PartyBillingMode,
): readonly PartyBillingStatementDto["status"][] | undefined {
  if (mode === "paid") return ["closed"];
  if (mode === "statements")
    return ["draft", "issued", "invoice_received", "cancelled"];
  return undefined;
}

/** Search over deed/PO/task then oldest accrual first, else property label. */
export function searchAndSortDues(
  lines: PartyBillingReadyLineDto[],
  search: string,
): PartyBillingReadyLineDto[] {
  const needle = search.trim().toLowerCase();
  let list = lines;
  if (needle) {
    list = list.filter((l) =>
      `${l.propertyLabel} ${l.poNumber} ${l.workflowTaskId}`
        .toLowerCase()
        .includes(needle),
    );
  }
  return [...list].sort((a, b) => {
    const aa = daysSinceIsoCost(a.accruedAtUtc ?? a.updatedAtUtc) ?? -1;
    const bb = daysSinceIsoCost(b.accruedAtUtc ?? b.updatedAtUtc) ?? -1;
    if (aa >= 0 && bb >= 0 && aa !== bb) return bb - aa;
    return (a.propertyLabel || "").localeCompare(b.propertyLabel || "", "ar");
  });
}

/** Net of the currently ticked dues — zero-net lines are not selectable. */
export function selectedDuesTotal(
  lines: PartyBillingReadyLineDto[],
  selected: ReadonlySet<string>,
): number {
  let total = 0;
  for (const line of lines) {
    if (selected.has(line.workflowTaskId)) total += line.netFeeSar;
  }
  return total;
}

export function partyBillingSections(mode: PartyBillingMode): {
  showDues: boolean;
  showStatements: boolean;
} {
  return {
    showDues: mode === "all" || mode === "dues",
    showStatements: mode === "all" || mode === "statements" || mode === "paid",
  };
}
