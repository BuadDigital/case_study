/**
 * Pure state behind `ActiveTransactionQueueView`: the queue config contract, the
 * layout flags derived from it, the listed-task projection, the filter option
 * pass and the PO grouping. No React, no I/O — `useActiveTransactionQueueWorkflow`
 * calls these and the view only renders their output.
 */
import type { ReactNode } from "react";
import type { RowMoreMenuItem } from "@platform/ui-kit";
import type { PageId, RoleId } from "@platform/types";
import type {
  WorkflowTaskListFilters,
  WorkflowTaskListQuery,
  WorkflowTaskListSort,
} from "@platform/api-client";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import { seesAllCaseStudyWorkflowTasks } from "../lib/app-data/viewer-task-access";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import {
  compareQueueTasksByUpdatedNewestFirst,
  compareQueueTasksNewestFirst,
  compareQueueTasksOldestFirst,
} from "../lib/app-data/my-task-row";
import { isListedQueueTask } from "../lib/app-data/suspended-transactions-model";
import {
  buildDistributionQueueRowMeta,
  buildPrimaryQueueRowMeta,
  uniqueSortedLabels,
} from "../lib/app-data/active-queue-list-filters";
import {
  buildAllTransactionsQueueRowMeta,
  uniqueSortedPoOrder,
} from "../lib/app-data/all-transactions-queue";
import { appraiserQueueStatusGroup } from "../lib/evaluator-bridge";

export const APPRAISAL_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "new", label: "جديدة" },
  { value: "wait_inspection", label: "تراقب تقدم الأطراف" },
  { value: "ready", label: "جاهزة للتقييم" },
  { value: "submitted", label: "مُرسَلة للأخصائي" },
  { value: "closed", label: "مكتملة على النظام" },
  { value: "reopened", label: "معادة للتصحيح" },
];

export type ActiveTransactionQueueTableLayout =
  | "primary-data"
  | "distribution"
  | "case-study"
  | "all-transactions"
  | "engineering-survey"
  | "property-appraisal";

export type ActiveTransactionQueueConfig = {
  pageTitle: string;
  /** Hide in-page hero title when the top bar already shows the same label. */
  hidePageTitle?: boolean;
  emptyLine: string;
  emptyHint: string;
  panelId: string;
  /** Column set for the queue table (default: primary-data). */
  tableLayout?: ActiveTransactionQueueTableLayout;
  /** Hint under the queue table; defaults to distribution wording. */
  tableHint?: string;
  /** Filter by prototype assignee id from transaction distribution. */
  partyAssignee?: boolean;
  /** Page id for queue context (e.g. party pages). */
  pageId?: PageId;
  /** Role whose queue is shown (party pages); CDO uses this to see all assignees. */
  assigneeRole?: RoleId;
  getBasePath: () => string;
  getTaskPath: (taskId: string) => string;
  /** Navigate to a dedicated page instead of opening the side panel. */
  fullPageTaskPath?: (taskId: string) => string;
  /** Per-task full-page navigation (e.g. all-transactions for mixed party queues). */
  resolveFullPageTaskPath?: (task: WorkflowTask) => string | undefined;
  filterListed: (
    mine: WorkflowTask[],
    poByNumber: Map<string, PoIntakeRecord>,
    options?: { showCompleted?: boolean },
  ) => WorkflowTask[];
  /** Override row ⋮ menu (e.g. appraiser recall). */
  buildRowMoreItems?: (ctx: ActiveQueueRowMoreContext) => RowMoreMenuItem[];
  /** When true, table/card row click does nothing; deed, PO, and ⋮ stay clickable. */
  disableRowOpen?: boolean;
  /** Enable «return to previous stage» in the default ⋮ menu. */
  allowPhaseRevert?: boolean;
  /** Enable «copy from previous transaction» in the default ⋮ menu (target = this row). */
  allowCopyFromPrior?: boolean;
  /** Enable «delete transaction» in the default ⋮ menu. */
  allowDeleteTransaction?: boolean;
  /** When false, row click does not open the work panel. */
  canOpenTask?: (task: WorkflowTask) => boolean;
  /** Replaces remaining-time cell when set (e.g. submission status). */
  getTaskStatusBadge?: (
    task: WorkflowTask,
  ) => { label: string; className: string } | null;
  statusColumnLabel?: string;
  /** Re-bump queue when these window events fire. */
  refreshOnWindowEvents?: string[];
  /** Stats / filters above the queue table (e.g. engineering office dashboard). */
  renderQueueHeader?: (listed: WorkflowTask[]) => ReactNode;
  /** Default: most recently updated / distributed task first. */
  queueSort?: QueueSortMode;
  /** When true, list open, blocked, and completed tasks (e.g. all-transactions). */
  includeAllStatuses?: boolean;
  /**
   * Server-side narrowing for this queue's list request
   * (`docs/architecture/pagination-contract.md` §2). It must never be narrower
   * than `filterListed`: the client only ever refines further.
   */
  serverQuery?: {
    kind?: readonly string[];
    phase?: readonly string[];
    status?: readonly string[];
    assignmentType?: string;
  };
};

/** What `isListedQueueTask` keeps when the screen is not showing everything. */
export const QUEUE_DEFAULT_STATUSES = ["open", "blocked"] as const;

/**
 * Every order a queue can ask for. `deed-first` / `city-first` are the two the
 * server grew in pagination-contract §2 — the queue no longer has to load the
 * PO records to order by a deed number or a city.
 */
export type QueueSortMode =
  | "oldest-first"
  | "newest-first"
  | "distributed-newest-first"
  | "deed-first"
  | "city-first";

/** Rows per server page for the queues that page (pagination-contract §2). */
export const QUEUE_PAGE_SIZE = 25;

/** The queue sort modes, mapped onto the endpoint's sort keys. */
export function queueServerSort(queueSort: QueueSortMode | undefined): {
  sort: WorkflowTaskListSort;
  dir: "asc" | "desc";
} {
  switch (queueSort) {
    case "oldest-first":
      return { sort: "poReceived", dir: "asc" };
    case "newest-first":
      return { sort: "poCreated", dir: "desc" };
    case "deed-first":
      return { sort: "deed", dir: "asc" };
    case "city-first":
      return { sort: "city", dir: "asc" };
    default:
      return { sort: "updated", dir: "desc" };
  }
}

/**
 * The `assigneeRole` the server may filter on. Mirrors
 * `resolveQueueTasksForViewer`: both `tasksForRole` and `tasksForPartyAssignee`
 * keep only `assigneeRole === role`, so this is always a superset of what the
 * client keeps. `undefined` means "this viewer sees every role".
 */
export function resolveQueueServerAssigneeRole(input: {
  role: RoleId;
  pageId?: PageId;
  partyAssignee?: boolean;
  assigneeRole?: RoleId;
}): string | undefined {
  if (input.pageId && seesAllCaseStudyWorkflowTasks(input.role, input.pageId)) {
    return undefined;
  }
  if (input.partyAssignee) {
    if (isSuperAdmin(input.role)) return input.assigneeRole ?? undefined;
    return input.role;
  }
  return isSuperAdmin(input.role) ? undefined : input.role;
}

/**
 * The list parameters this queue sends to the server. Returns `{}` when the
 * screen still needs rows the narrowing would drop (sibling tasks for the
 * distribution / case-study / appraisal tables) — then the request is exactly
 * the one the screen made before this contract.
 */
export function buildQueueServerQuery(input: {
  config: ActiveTransactionQueueConfig;
  role: RoleId;
  showCompleted: boolean;
  /** false → no narrowing at all; the screen reads sibling rows. */
  narrow: boolean;
  /**
   * The search box, sent as `q`. Only the paged layouts pass it: the server
   * matches the task's own columns plus the five PO-record columns
   * (pagination-contract §2), which is exactly what the queue used to filter
   * on. A sibling-reading layout must leave it out, or `q` would drop the
   * children its party columns read.
   */
  search?: string;
}): WorkflowTaskListFilters {
  const { config } = input;
  if (!input.narrow) return {};
  const q = input.search?.trim() ?? "";

  const showAllToggle =
    config.tableLayout === "engineering-survey" ||
    config.tableLayout === "property-appraisal";
  const showAll =
    Boolean(config.includeAllStatuses) || (showAllToggle && input.showCompleted);
  const status =
    config.serverQuery?.status ??
    (showAll ? undefined : QUEUE_DEFAULT_STATUSES);
  const assigneeRole = resolveQueueServerAssigneeRole({
    role: input.role,
    pageId: config.pageId,
    partyAssignee: config.partyAssignee,
    assigneeRole: config.assigneeRole,
  });
  const { sort, dir } = queueServerSort(config.queueSort);

  return {
    ...(config.serverQuery?.kind?.length ? { kind: config.serverQuery.kind } : {}),
    ...(config.serverQuery?.phase?.length
      ? { phase: config.serverQuery.phase }
      : {}),
    ...(status?.length ? { status } : {}),
    ...(config.serverQuery?.assignmentType
      ? { assignmentType: config.serverQuery.assignmentType }
      : {}),
    ...(assigneeRole ? { assigneeRole } : {}),
    ...(q ? { q } : {}),
    sort,
    dir,
  };
}

/**
 * Which layouts can be driven off one server page.
 *
 * A layout may page only when its rows are 1:1 with the tasks the endpoint
 * returns. Three read a *parent's children* out of the same list — distribution
 * and case-study build the party columns from sibling tasks, and the appraiser
 * table reads the sibling field-inspection row (pagination-contract §2, "still
 * client-side" #2) — and all-transactions collapses every sibling task of a
 * property down to its furthest stage (`collapseAllTransactionsToLatestPhase`),
 * which removes rows after materialisation and would make `totalCount` disagree
 * with the page. Those four keep the request they made before this contract.
 */
export function queueLayoutSupportsPaging(
  layout: ActiveTransactionQueueTableLayout | undefined,
): boolean {
  return (
    layout !== "distribution" &&
    layout !== "case-study" &&
    layout !== "property-appraisal" &&
    layout !== "all-transactions"
  );
}

/** The page window a paged queue sends on top of its filters. */
export function buildQueuePageQuery(input: {
  filters: WorkflowTaskListFilters;
  page: number;
  pageSize?: number;
}): WorkflowTaskListQuery {
  return {
    ...input.filters,
    page: Math.max(1, Math.trunc(input.page) || 1),
    pageSize: input.pageSize ?? QUEUE_PAGE_SIZE,
  };
}

/**
 * Pager numbers from the server envelope. `totalCount` is the actor's total, but
 * the four rules §2 keeps in the browser (badge-label status, appraisal groups,
 * the suspended-property exclusion and `config.filterListed`) still run after
 * the page is cut, so `shownOnPage` is what the viewer actually sees.
 */
export function queuePagination(input: {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  shownOnPage: number;
}) {
  const pageSize = input.pageSize > 0 ? input.pageSize : QUEUE_PAGE_SIZE;
  const totalPages = Math.max(1, input.totalPages);
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  const rangeStart = input.totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  return {
    totalCount: input.totalCount,
    totalPages,
    safePage,
    rangeStart,
    rangeEnd:
      input.totalCount === 0 ? 0 : rangeStart + Math.max(0, input.shownOnPage) - 1,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

export type ActiveQueueRowMoreContext = {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  refreshQueue: () => void;
  showToast: (message: string, tone?: "success" | "error" | "info") => void;
  poByNumber: Map<string, PoIntakeRecord>;
  viewerRole: RoleId;
};

export type ActiveQueueApi = {
  listed: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  openTask: (taskId: string) => void;
  closePanel: () => void;
  setAdvancing: (value: boolean) => void;
  syncQueue: () => Promise<void>;
};

export type AllTransactionsRowMeta = ReturnType<
  typeof buildAllTransactionsQueueRowMeta
>[number];
export type PrimaryRowMeta = ReturnType<typeof buildPrimaryQueueRowMeta>[number];
export type DistributionRowMeta = ReturnType<
  typeof buildDistributionQueueRowMeta
>[number];

/** Which table/columns this queue renders — one derivation instead of six inline checks. */
export type QueueLayoutFlags = {
  isPropertyInspectionQueue: boolean;
  isDistributionTable: boolean;
  isAllTransactionsTable: boolean;
  isEngineeringSurveyTable: boolean;
  isPropertyAppraisalTable: boolean;
  isPartyQueueToggleTable: boolean;
  showPartyColumns: boolean;
};

export function resolveQueueLayoutFlags(
  config: ActiveTransactionQueueConfig,
): QueueLayoutFlags {
  const isEngineeringSurveyTable = config.tableLayout === "engineering-survey";
  const isPropertyAppraisalTable = config.tableLayout === "property-appraisal";
  return {
    isPropertyInspectionQueue:
      config.pageId === "property-inspection" ||
      config.pageId === "active-inspection",
    isDistributionTable:
      config.tableLayout === "distribution" ||
      config.tableLayout === "case-study",
    isAllTransactionsTable: config.tableLayout === "all-transactions",
    isEngineeringSurveyTable,
    isPropertyAppraisalTable,
    isPartyQueueToggleTable:
      isEngineeringSurveyTable || isPropertyAppraisalTable,
    showPartyColumns: config.tableLayout === "case-study",
  };
}

export function buildPoByNumber(
  poRecords: PoIntakeRecord[],
): Map<string, PoIntakeRecord> {
  const map = new Map<string, PoIntakeRecord>();
  for (const r of poRecords) map.set(r.poNumber.trim(), r);
  return map;
}

/**
 * Client twin of `queueServerSort`, so an unpaged layout lists rows in the same
 * order the endpoint would have returned them. `deed-first` / `city-first` read
 * the columns the server now puts on the row (pagination-contract §2), with the
 * endpoint's null handling: a task with no property sorts first ascending.
 */
export function queueSortComparator(
  sortMode: QueueSortMode,
): (
  a: WorkflowTask,
  b: WorkflowTask,
  poByNumber: Map<string, PoIntakeRecord>,
) => number {
  switch (sortMode) {
    case "oldest-first":
      return compareQueueTasksOldestFirst;
    case "newest-first":
      return compareQueueTasksNewestFirst;
    case "deed-first":
      return (a, b) => compareQueueTasksByColumn(a, b, (t) => t.deedNumber);
    case "city-first":
      return (a, b) => compareQueueTasksByColumn(a, b, (t) => t.city);
    default:
      return compareQueueTasksByUpdatedNewestFirst;
  }
}

/** Ascending by a PO-record column, nulls first, then the endpoint's tiebreakers. */
function compareQueueTasksByColumn(
  a: WorkflowTask,
  b: WorkflowTask,
  pick: (task: WorkflowTask) => string | undefined,
): number {
  const left = pick(a)?.trim() ?? "";
  const right = pick(b)?.trim() ?? "";
  if (left !== right) {
    if (!left) return -1;
    if (!right) return 1;
    const cmp = left.localeCompare(right, "ar");
    if (cmp !== 0) return cmp;
  }
  const poCmp = a.poNumber.trim().localeCompare(b.poNumber.trim(), "ar");
  if (poCmp !== 0) return poCmp;
  if (a.propertyOrdinal !== b.propertyOrdinal) {
    return a.propertyOrdinal - b.propertyOrdinal;
  }
  return a.id.localeCompare(b.id);
}

/** The queue rows this page lists: config filter, listable statuses, then the page sort. */
export function buildListedQueue({
  config,
  mine,
  poByNumber,
  showCompleted,
}: {
  config: ActiveTransactionQueueConfig;
  mine: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  showCompleted: boolean;
}): WorkflowTask[] {
  const sortMode = config.queueSort ?? "distributed-newest-first";
  const compare = queueSortComparator(sortMode);
  const isSurveyLayout = config.tableLayout === "engineering-survey";
  const isAppraisalLayout = config.tableLayout === "property-appraisal";
  const showAllToggle = isSurveyLayout || isAppraisalLayout;
  return config
    .filterListed(mine, poByNumber, {
      showCompleted: showAllToggle ? showCompleted : undefined,
    })
    .filter((t) =>
      isListedQueueTask(t, {
        includeAllStatuses:
          config.includeAllStatuses || (showAllToggle && showCompleted),
      }),
    )
    .sort((a, b) => compare(a, b, poByNumber));
}

/** The three assignment-type labels the data ever carries (pagination-contract §1). */
export const QUEUE_ASSIGNMENT_TYPE_OPTIONS: readonly string[] = [
  "تنفيذ",
  "تركات",
  "قطاع خاص",
];

/* Hide city/district columns when none carry data at this stage — «—» in every row is noise.
   One pass over rows gathers type/status options and location checks together (js-combine-iterations). */
export function buildQueueFilterOptions({
  flags,
  allTransactionsRowMeta,
  distributionRowMeta,
  primaryRowMeta,
  paged = false,
}: {
  flags: QueueLayoutFlags;
  allTransactionsRowMeta: AllTransactionsRowMeta[];
  distributionRowMeta: DistributionRowMeta[];
  primaryRowMeta: PrimaryRowMeta[];
  /**
   * A paged queue holds one page, so the assignment-type dropdown cannot be
   * derived from it — it lists the three labels the data ever carries instead
   * (the same move as pagination-contract §1, "still client-side" #5). The
   * status dropdown has no closed vocabulary (its labels come from the
   * field-inspection workspace and the SLA clock), so it stays page-derived.
   */
  paged?: boolean;
}): {
  primaryHasLocation: boolean;
  assignmentTypes: string[];
  statusOptions: string[];
} {
  let hasLocation = false;
  const types: string[] = [];
  const statuses: string[] = [];
  if (flags.isAllTransactionsTable) {
    for (const row of allTransactionsRowMeta) {
      types.push(row.assignmentType);
      statuses.push(row.phaseLabel);
    }
  } else if (flags.isDistributionTable) {
    for (const row of distributionRowMeta) types.push(row.assignmentType);
  } else {
    for (const row of primaryRowMeta) {
      types.push(row.assignmentType);
      statuses.push(row.statusLabel);
      if (
        (row.city && row.city !== "—") ||
        (row.district && row.district !== "—")
      ) {
        hasLocation = true;
      }
    }
  }
  return {
    primaryHasLocation: hasLocation,
    assignmentTypes: paged
      ? [...QUEUE_ASSIGNMENT_TYPE_OPTIONS]
      : uniqueSortedLabels(types),
    statusOptions: flags.isPropertyAppraisalTable
      ? APPRAISAL_STATUS_FILTERS.map((o) => o.label)
      : uniqueSortedLabels(statuses),
  };
}

/** Appraiser queue filters on the appraisal status group instead of the row status label. */
export function filterAppraisalRowMeta({
  primaryRowMeta,
  search,
  statusFilter,
  tasks,
}: {
  primaryRowMeta: PrimaryRowMeta[];
  search: string;
  statusFilter: string;
  tasks: WorkflowTask[];
}): PrimaryRowMeta[] {
  const q = search.trim();
  const statusValue =
    APPRAISAL_STATUS_FILTERS.find((o) => o.label === statusFilter)?.value ?? "";
  return primaryRowMeta.filter((meta) => {
    // With no search, skip building the match text entirely — used to allocate an array and string
    // per row then discard them (js-early-exit).
    if (q) {
      const cityDistrict = [meta.row.city, meta.row.district]
        .filter((v) => v && v !== "—")
        .join(" — ");
      const hay = `${meta.row.deedLabel} ${cityDistrict} ${meta.row.propertySlot}`;
      if (!hay.includes(q)) return false;
    }
    if (statusValue) {
      if (appraiserQueueStatusGroup(meta.task, tasks) !== statusValue) {
        return false;
      }
    }
    return true;
  });
}

export function buildAllTxPoGroups(
  rows: AllTransactionsRowMeta[],
): { po: string; rows: AllTransactionsRowMeta[] }[] {
  const byPo = new Map<string, AllTransactionsRowMeta[]>();
  for (const row of rows) {
    const list = byPo.get(row.poNumber) ?? [];
    list.push(row);
    byPo.set(row.poNumber, list);
  }
  return uniqueSortedPoOrder(rows.map((r) => r.poNumber)).map((po) => ({
    po,
    rows: byPo.get(po) ?? [],
  }));
}
