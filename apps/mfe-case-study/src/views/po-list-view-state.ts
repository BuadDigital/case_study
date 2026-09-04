/**
 * Pure list/row rules behind `PoListView`. No React, no writes — every export is
 * a function of the PO rows plus the current filters, so the view keeps JSX and
 * event wiring only and the workflow hook keeps queries and commands.
 */
import type { PoRow } from "@platform/app-shared/app-data/constants";
import {
  isPoListStatusTerminal,
  poProgressPct,
  type PoListStatus,
} from "@platform/app-shared/app-data/po-list-status";
import {
  poPropertiesPath,
  poPropertyPath,
} from "@platform/app-shared/domain/po-routes";
import { isPastDue } from "../lib/app-data/po-intake-data";
import {
  buildPoListPageDisplay,
  poListServerSearchTerm,
  type PoDeedIndexEntry,
  type PoListDisplayItem,
} from "../lib/app-data/po-list-search";
import type { WorkOrderListQuery } from "@platform/api-client";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";

export type SortKey = "created" | "po" | "received" | "due";
export type SortDir = "asc" | "desc";
export type StatusFilter = PoListStatus | "";

export const PO_LIST_PAGE_SIZE = 10;

/** Avatar colors for the team stack — index cycles through the list. */
export const TEAM_COLORS = [
  "#12284C",
  "#a4906f",
  "#22406e",
  "#8c7857",
  "#3f8f5f",
];

export function teamInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : "?";
}

export function isDueSoon(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10));
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

export function isDueUrgent(dueIso: string, status: PoRow["status"]): boolean {
  if (!dueIso || isPoListStatusTerminal(status)) return false;
  return isPastDue(dueIso) || isDueSoon(dueIso);
}

export function isDueWithin48(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10)).getTime();
  const now = Date.now();
  return due >= now && due <= now + 2 * 24 * 60 * 60 * 1000;
}

/** Progress-bar fill — green at ≥60%, gold when any progress, transparent at zero. */
export function progFill(pct: number): string {
  if (pct >= 60) return "linear-gradient(90deg, var(--ink), var(--navy-3))";
  if (pct > 0) return "linear-gradient(90deg, var(--gold-d), var(--gold))";
  return "transparent";
}

export function poStatusStyle(status: PoRow["status"]): {
  base: string;
  fg: string;
  live: boolean;
} {
  switch (status) {
    case "under_study":
      return { base: "var(--gold)", fg: "var(--gold-d)", live: true };
    case "completed":
    case "fully_billed":
      return { base: "#3f8f5f", fg: "#2f7a4d", live: false };
    case "partially_billed":
      return { base: "#d9a441", fg: "#b8791a", live: false };
    case "stopped":
      return { base: "#8a8d96", fg: "#696c75", live: false };
    case "cancelled":
      return { base: "var(--red)", fg: "var(--red-text)", live: false };
    default:
      return { base: "var(--heading)", fg: "var(--heading)", live: false };
  }
}

export type PoListKpi = {
  active: number;
  overdue: number;
  dueSoon: number;
  doneProps: number;
};

/** One pass over the list computes the four counters (js-combine-iterations). */
export function poListKpi(list: PoRow[]): PoListKpi {
  let active = 0;
  let overdue = 0;
  let dueSoon = 0;
  let doneProps = 0;
  for (const p of list) {
    doneProps += p.done ?? 0;
    if (isPoListStatusTerminal(p.status)) continue;
    active += 1;
    if (p.dueDate && isPastDue(p.dueDate)) overdue += 1;
    if (p.dueDate && isDueWithin48(p.dueDate)) dueSoon += 1;
  }
  return { active, overdue, dueSoon, doneProps };
}

/**
 * Assignment-type filter options. With server paging the dropdown can no longer
 * be derived from the loaded rows (they are one page), so it lists the three
 * labels the endpoint accepts — pagination-contract §1, "still client-side" #5.
 */
export const PO_ASSIGNMENT_TYPE_OPTIONS: readonly string[] = [
  "تنفيذ",
  "تركات",
  "قطاع خاص",
];

/** PO number → distinct assignee names from the workflow tasks. */
export function teamNamesByPo(
  tasks: readonly WorkflowTask[] | undefined,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const task of tasks ?? []) {
    const po = task.poNumber?.trim();
    const name = task.assigneeName?.trim();
    if (!po || !name || name === "—" || name === "-") continue;
    const current = map.get(po) ?? [];
    if (!current.includes(name)) current.push(name);
    map.set(po, current);
  }
  return map;
}

/** PO number → registered deed count, from the deed index. */
export function registeredCountsByPo(
  deedIndex: PoDeedIndexEntry[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of deedIndex) {
    counts.set(entry.poNumber, (counts.get(entry.poNumber) ?? 0) + 1);
  }
  return counts;
}

/** Task assignees for the row, else the assignment specialist alone. */
export function teamMembersForRow(
  teamByPo: Map<string, string[]>,
  row: PoRow,
): string[] {
  const fromTasks = teamByPo.get(row.id) ?? [];
  if (fromTasks.length > 0) return fromTasks;
  return row.specialist?.trim() && row.specialist !== "—"
    ? [row.specialist.trim()]
    : [];
}

/**
 * The screen's query state — every field of it is sent to the server
 * (`docs/architecture/pagination-contract.md` §1). Nothing here slices or sorts
 * rows in the browser.
 */
export type PoListQueryState = {
  page: number;
  search: string;
  statusFilter: StatusFilter;
  typeFilter: string;
  sortKey: SortKey;
  sortDir: SortDir;
};

export const INITIAL_PO_LIST_QUERY: PoListQueryState = {
  page: 1,
  search: "",
  statusFilter: "",
  typeFilter: "",
  sortKey: "created",
  sortDir: "desc",
};

export type PoListQueryAction =
  | { type: "page"; page: number }
  | { type: "search"; value: string }
  | { type: "status"; value: StatusFilter }
  | { type: "assignmentType"; value: string }
  | { type: "sort"; key: SortKey };

/** Default direction when a column becomes the active sort. */
function defaultSortDir(key: SortKey): SortDir {
  return key === "po" || key === "created" ? "desc" : "asc";
}

/**
 * Pure reducer: any filter or search change resets to page 1, a repeated sort
 * click flips the direction, and an unchanged value returns the same object so
 * the query key — and the request — stays stable.
 */
export function poListQueryReducer(
  state: PoListQueryState,
  action: PoListQueryAction,
): PoListQueryState {
  switch (action.type) {
    case "page": {
      const page = Math.max(1, Math.trunc(action.page) || 1);
      return page === state.page ? state : { ...state, page };
    }
    case "search":
      return action.value === state.search
        ? state
        : { ...state, search: action.value, page: 1 };
    case "status":
      return action.value === state.statusFilter
        ? state
        : { ...state, statusFilter: action.value, page: 1 };
    case "assignmentType":
      return action.value === state.typeFilter
        ? state
        : { ...state, typeFilter: action.value, page: 1 };
    case "sort":
      return state.sortKey === action.key
        ? {
            ...state,
            sortDir: state.sortDir === "asc" ? "desc" : "asc",
            page: 1,
          }
        : {
            ...state,
            sortKey: action.key,
            sortDir: defaultSortDir(action.key),
            page: 1,
          };
    default:
      return state;
  }
}

/**
 * The two billing buckets the server can only widen to their study bucket —
 * whether Finance issued an Enfaz invoice lives in another context and cannot
 * be a SQL predicate (pagination-contract §1, "still client-side" #1). The
 * screen therefore asks for one generous page of the widened bucket and does
 * the narrowing, and the windowing, itself.
 */
export const PO_LIST_BILLING_BUCKETS: readonly StatusFilter[] = [
  "partially_billed",
  "fully_billed",
];

/** Server max page size — used for the billing buckets only. */
export const PO_LIST_BILLING_PAGE_SIZE = 500;

export function isPoListBillingBucket(status: StatusFilter): boolean {
  return PO_LIST_BILLING_BUCKETS.includes(status);
}

/** Query state → the `GET /api/work-orders` parameters. */
export function toWorkOrderListQuery(
  state: PoListQueryState,
  options?: { search?: string },
): WorkOrderListQuery {
  const billing = isPoListBillingBucket(state.statusFilter);
  const q = poListServerSearchTerm(options?.search ?? state.search);
  return {
    page: billing ? 1 : state.page,
    pageSize: billing ? PO_LIST_BILLING_PAGE_SIZE : PO_LIST_PAGE_SIZE,
    sort: state.sortKey,
    dir: state.sortDir,
    ...(q ? { q } : {}),
    ...(state.statusFilter ? { status: state.statusFilter } : {}),
    ...(state.typeFilter ? { type: state.typeFilter } : {}),
  };
}

/**
 * Server page → display rows. The server already applied status, type, `q` and
 * the sort; only the billing refinement and the deed-mode expansion are left.
 */
export function buildPoListPageRows(input: {
  rows: PoRow[];
  search: string;
  deedIndex: PoDeedIndexEntry[];
  statusFilter: StatusFilter;
}): PoListDisplayItem[] {
  const rows = isPoListBillingBucket(input.statusFilter)
    ? input.rows.filter((row) => row.status === input.statusFilter)
    : input.rows;
  return buildPoListPageDisplay(rows, input.search, input.deedIndex);
}

export type PoListRowView = {
  row: PoRow;
  deedEntry: PoDeedIndexEntry | null;
  studied: number;
  expected: number;
  pct: number;
  urgent: boolean;
  /** Deep link — the matched property when the search found one, else the PO. */
  target: string;
  rowKey: string;
};

/** Per-row derivations shared by the desktop table and the mobile cards. */
export function poListRowView(
  entry: PoListDisplayItem,
  registeredByPo: Map<string, number>,
): PoListRowView {
  const p = entry.view === "po" ? entry.item.row : entry.item.row;
  const deedEntry = entry.view === "property" ? entry.item.deed : null;
  const match = entry.view === "po" ? entry.item.match : entry.item.match;
  const registered = p.registered ?? registeredByPo.get(p.id) ?? 0;
  const studied = p.done ?? 0;
  const expected = p.count ?? 0;
  return {
    row: p,
    deedEntry,
    studied,
    expected,
    pct: poProgressPct(registered, studied, expected),
    urgent: isDueUrgent(p.dueDate, p.status),
    target:
      deedEntry || match?.propertyId
        ? poPropertyPath(p.id, deedEntry?.propertyId ?? match!.propertyId!)
        : poPropertiesPath(p.id),
    rowKey:
      entry.view === "property" ? `${p.id}-${deedEntry!.propertyId}` : p.id,
  };
}

/**
 * Pager numbers from the server envelope: `totalCount` / `totalPages` are the
 * actor's real totals, not the loaded rows.
 */
export function poListServerPagination(input: {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}) {
  const pageSize = input.pageSize > 0 ? input.pageSize : PO_LIST_PAGE_SIZE;
  const totalPages = Math.max(1, input.totalPages);
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  return {
    totalPages,
    safePage,
    rangeStart: input.totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, input.totalCount),
  };
}

/** Client-side window over the billing buckets, which the server can only widen. */
export function poListBillingWindow<T>(rows: T[], page: number) {
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PO_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PO_LIST_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + PO_LIST_PAGE_SIZE),
    totalCount,
    totalPages,
    safePage,
    rangeStart: totalCount === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + PO_LIST_PAGE_SIZE, totalCount),
  };
}
