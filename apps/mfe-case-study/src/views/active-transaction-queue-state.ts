/**
 * Pure state behind `ActiveTransactionQueueView`: the queue config contract, the
 * layout flags derived from it, the listed-task projection, the filter option
 * pass and the PO grouping. No React, no I/O — `useActiveTransactionQueueWorkflow`
 * calls these and the view only renders their output.
 */
import type { ReactNode } from "react";
import type { RowMoreMenuItem } from "@platform/ui-kit";
import type { PageId, RoleId } from "@platform/types";
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
  queueSort?: "oldest-first" | "newest-first" | "distributed-newest-first";
  /** When true, list open, blocked, and completed tasks (e.g. all-transactions). */
  includeAllStatuses?: boolean;
};

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
  const compare =
    sortMode === "oldest-first"
      ? compareQueueTasksOldestFirst
      : sortMode === "newest-first"
        ? compareQueueTasksNewestFirst
        : compareQueueTasksByUpdatedNewestFirst;
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

/* Hide city/district columns when none carry data at this stage — «—» in every row is noise.
   One pass over rows gathers type/status options and location checks together (js-combine-iterations). */
export function buildQueueFilterOptions({
  flags,
  allTransactionsRowMeta,
  distributionRowMeta,
  primaryRowMeta,
}: {
  flags: QueueLayoutFlags;
  allTransactionsRowMeta: AllTransactionsRowMeta[];
  distributionRowMeta: DistributionRowMeta[];
  primaryRowMeta: PrimaryRowMeta[];
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
    assignmentTypes: uniqueSortedLabels(types),
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
