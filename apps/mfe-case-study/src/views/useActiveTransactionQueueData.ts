"use client";

/**
 * Read half of `useActiveTransactionQueueWorkflow`: the queue and PO queries,
 * viewer scoping, the filter state, the row-meta projections, the party
 * progress map and the pager numbers. Navigation, refreshes and the row
 * commands live in `useActiveTransactionQueueCommands`; the pure projections
 * in `active-transaction-queue-state`.
 */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { getAuthSession } from "@platform/auth-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import {
  getCachedPartySubmission,
  partySubmissionTaskIdsKey,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  usePoRecordsQuery,
  useWorkflowTasksFilteredQuery,
  useWorkflowTasksPageQuery,
} from "@case-study/mfe/query/case-study-queries";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { resolveQueueTasksForViewer } from "../lib/app-data/viewer-task-access";
import {
  buildDistributionQueueRowMeta,
  buildPrimaryQueueRowMeta,
  filterDistributionQueueRows,
  filterPrimaryQueueRowMeta,
  resolveQueueTaskStatusBadge,
} from "../lib/app-data/active-queue-list-filters";
import {
  buildAllTransactionsQueueRowMeta,
  filterAllTransactionsQueueRows,
} from "../lib/app-data/all-transactions-queue";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import { useQueuePartyProgress } from "./useQueuePartyProgress";
import {
  buildListedQueue,
  buildPoByNumber,
  buildQueueFilterOptions,
  buildQueuePageQuery,
  buildQueueServerQuery,
  filterAllTxMetaToListed,
  filterAppraisalRowMeta,
  queueLayoutSupportsPaging,
  queueLoadErrorMessage,
  queuePagination,
  QUEUE_PAGE_SIZE,
  resolveQueueLayoutFlags,
  type ActiveTransactionQueueConfig,
} from "./active-transaction-queue-state";

const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();
/* Stable empty refs for loading — a fresh `[]` each render invalidates every useMemo
   and memoized rows below (rerender-memo-with-default-value). */
const EMPTY_PO_RECORDS: PoIntakeRecord[] = [];
export const EMPTY_TASKS: WorkflowTask[] = [];
const EMPTY_STAFF_USERS: NonNullable<
  ReturnType<typeof useStaffUsersQuery>["data"]
>["users"] = [];
const EMPTY_INSPECTION_WORKSPACES: NonNullable<
  ReturnType<typeof useFieldInspectionWorkspacesQuery>["data"]
> = [];

export function useActiveTransactionQueueData({
  config,
}: {
  config: ActiveTransactionQueueConfig;
}) {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("task");
  const { role, viewerEmail, distributionAssigneeId } = useAppAccess();
  const { data: staffResult } = useStaffUsersQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
  const needsInspectionWorkspaces = Boolean(config.getTaskStatusBadge);
  const needsPartySubmissions = Boolean(config.getTaskStatusBadge);
  const { data: inspectionWorkspaces = EMPTY_INSPECTION_WORKSPACES } =
    useFieldInspectionWorkspacesQuery(needsInspectionWorkspaces);
  const inspectionWorkspaceByTaskId = useMemo(() => {
    const map = new Map(
      inspectionWorkspaces.map((row) => [row.workflowTaskId, row]),
    );
    return map;
  }, [inspectionWorkspaces]);
  const {
    data: poRecords = EMPTY_PO_RECORDS,
    isFetched: poRecordsFetched,
    isError: poRecordsError,
    error: poRecordsQueryError,
    refetch: refetchPoRecords,
  } = usePoRecordsQuery();
  // Minute precision is enough to build rows and filters — the per-second timer lives in
  // the timer cells themselves, so every row is not rebuilt each second (rerender-defer-reads).
  const nowMinuteMs = useTickingMinute();
  const now = useMemo(() => new Date(nowMinuteMs), [nowMinuteMs]);
  // After hydration mount only one tree (cards or table) — display:none hid
  // paint while rows were still built twice every render.
  const isDesktopViewport = useViewportDesktop();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCompleted, setShowCompleted] = useState(false);
  const [submissionCacheGen, setSubmissionCacheGen] = useState(0);

  const flags = useMemo(() => resolveQueueLayoutFlags(config), [config]);
  const {
    isDistributionTable,
    isAllTransactionsTable,
    isPropertyAppraisalTable,
    showPartyColumns,
  } = flags;

  /*
   * Sibling-reading tables cannot be narrowed: the distribution / case-study
   * tables read a parent's children and the appraiser table reads the sibling
   * field-inspection task, and both live outside this queue's kind/phase/role
   * slice (pagination-contract §2, "still client-side" #1 and #3). Those three
   * keep the full list; every other queue asks the server for its slice.
   */
  const needsSiblingTasks = isDistributionTable || isPropertyAppraisalTable;
  /*
   * A queue pages only when its rows are 1:1 with the endpoint's — see
   * `queueLayoutSupportsPaging`. The rest keep the request they made before this
   * contract: the whole narrowed (or, for the sibling readers, unnarrowed) list.
   */
  const paged = queueLayoutSupportsPaging(config.tableLayout);
  // The search box now drives a server request on a paged queue — debounce it
  // instead of deferring a local pass, or every keystroke would be a GET.
  const debouncedSearch = useDebouncedValue(search, 300);
  const queueServerQuery = useMemo(
    () =>
      buildQueueServerQuery({
        config,
        role,
        showCompleted,
        narrow: !needsSiblingTasks,
        search: paged ? debouncedSearch : undefined,
      }),
    [config, role, showCompleted, needsSiblingTasks, paged, debouncedSearch],
  );
  const queuePageQuery = useMemo(
    () => buildQueuePageQuery({ filters: queueServerQuery, page }),
    [queueServerQuery, page],
  );
  // Any change to the filters or the search resets to page 1 — page 3 of the old
  // query is never page 3 of the new one.
  const serverQueryKey = JSON.stringify(queueServerQuery);
  useEffect(() => {
    setPage(1);
  }, [serverQueryKey]);
  const listQuery = useWorkflowTasksFilteredQuery(queueServerQuery, {
    live: true,
    enabled: !paged,
  });
  const pageQuery = useWorkflowTasksPageQuery(queuePageQuery, {
    live: true,
    enabled: paged,
  });
  const {
    data: tasks,
    refetch: refetchTasks,
    isFetched: tasksFetched,
    isError: tasksError,
    error: tasksQueryError,
  } = paged
    ? {
        data: pageQuery.data?.rows,
        refetch: pageQuery.refetch,
        isFetched: pageQuery.isFetched,
        isError: pageQuery.isError,
        error: pageQuery.error,
      }
    : listQuery;
  const queueLoadError = tasksError || poRecordsError;
  const queueErrorMessage = queueLoadErrorMessage(
    tasksQueryError,
    poRecordsQueryError,
  );
  const queueReady = tasksFetched && poRecordsFetched && !queueLoadError;
  const queuePending = !tasksFetched || !poRecordsFetched;

  const retryQueueLoad = useCallback(() => {
    void refetchPoRecords();
    void refetchTasks();
  }, [refetchPoRecords, refetchTasks]);

  /** Party-submission badges read a cache — bump to re-resolve them after a refresh. */
  const refreshPartySubmissions = useCallback(() => {
    if (needsPartySubmissions) {
      setSubmissionCacheGen((n) => n + 1);
    }
  }, [needsPartySubmissions]);

  const poByNumber = useMemo(() => buildPoByNumber(poRecords), [poRecords]);

  const mine = useMemo(() => {
    return resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId: config.pageId,
      partyAssignee: config.partyAssignee,
      assigneeRole: config.assigneeRole,
      viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });
  }, [
    config.assigneeRole,
    config.pageId,
    config.partyAssignee,
    viewerEmail,
    distributionAssigneeId,
    role,
    tasks,
    staffUsers,
  ]);

  const listed = useMemo(
    () => buildListedQueue({ config, mine, poByNumber, showCompleted }),
    [config, mine, poByNumber, showCompleted],
  );

  const listedTaskIdsKey = useMemo(
    () => partySubmissionTaskIdsKey(listed.map((t) => t.id)),
    [listed],
  );

  const selectedTask = useMemo((): WorkflowTask | null => {
    if (!selectedId) return null;
    return listed.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, listed]);

  const resolveTaskBadge = useCallback(
    (task: WorkflowTask) =>
      resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
        partySubmission: getCachedPartySubmission(task.id),
      }),
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
  );

  useEffect(() => {
    if (!needsPartySubmissions || listedTaskIdsKey.length === 0) return;
    const ids = listedTaskIdsKey.split("\0");
    void prefetchPartySubmissionsForTasks(ids)
      .then(() => {
        setSubmissionCacheGen((n) => n + 1);
      })
      .catch((err: unknown) => {
        console.warn(
          "Party submission prefetch failed:",
          err instanceof Error ? err.message : err,
        );
      });
    // Re-run on every fresh `tasks` fetch (live poll or a server-pushed
    // workflow notification), not just when the id set changes — a returned/
    // reopened submission on an already-listed task needs a fresh badge too.
  }, [listedTaskIdsKey, needsPartySubmissions, tasks]);

  const allTransactionsRowMeta = useMemo(() => {
    if (!isAllTransactionsTable) return [];
    return buildAllTransactionsQueueRowMeta(listed, poByNumber, now);
  }, [isAllTransactionsTable, listed, poByNumber, now]);

  const primaryRowMeta = useMemo(() => {
    if (isDistributionTable || isAllTransactionsTable) return [];
    return buildPrimaryQueueRowMeta(listed, poByNumber, now, resolveTaskBadge);
  }, [
    isDistributionTable,
    isAllTransactionsTable,
    listed,
    poByNumber,
    now,
    resolveTaskBadge,
  ]);

  const distributionRowMeta = useMemo(() => {
    if (!isDistributionTable) return [];
    return buildDistributionQueueRowMeta(listed, poByNumber);
  }, [isDistributionTable, listed, poByNumber]);

  const { primaryHasLocation, assignmentTypes, statusOptions } = useMemo(
    () =>
      buildQueueFilterOptions({
        flags,
        allTransactionsRowMeta,
        distributionRowMeta,
        primaryRowMeta,
        paged,
      }),
    [flags, allTransactionsRowMeta, distributionRowMeta, primaryRowMeta, paged],
  );

  // Typing in search stays immediate while filtering unbounded lists is deferred one frame
  // (rerender-use-deferred-value) — no network here, local filtering only.
  const deferredSearch = useDeferredValue(search);

  // meta for filtered rows — tables and cards read the prebuilt row instead of calling
  // buildPrimaryDataTableRow 3–4 times per task every render (js-combine-iterations).
  const filteredPrimaryMeta = useMemo(() => {
    if (isAllTransactionsTable || isDistributionTable) return [];
    if (isPropertyAppraisalTable) {
      return filterAppraisalRowMeta({
        primaryRowMeta,
        search: deferredSearch,
        statusFilter,
        tasks: tasks ?? EMPTY_TASKS,
      });
    }
    // No search pass: this queue pages, and the server already matched `q`
    // against the deed / city / district haystack (pagination-contract §2).
    return filterPrimaryQueueRowMeta(primaryRowMeta, {
      statusFilter,
      typeFilter,
    });
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    isPropertyAppraisalTable,
    primaryRowMeta,
    tasks,
    deferredSearch,
    statusFilter,
    typeFilter,
  ]);

  const filteredListed = useMemo(() => {
    if (isAllTransactionsTable) {
      return filterAllTransactionsQueueRows(allTransactionsRowMeta, {
        search: deferredSearch,
        statusFilter,
        typeFilter,
      });
    }
    if (isDistributionTable) {
      return filterDistributionQueueRows(distributionRowMeta, {
        search: deferredSearch,
        typeFilter,
      });
    }
    return filteredPrimaryMeta.map((meta) => meta.task);
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    allTransactionsRowMeta,
    distributionRowMeta,
    filteredPrimaryMeta,
    deferredSearch,
    statusFilter,
    typeFilter,
  ]);

  const filteredAllTxMeta = useMemo(() => {
    if (!isAllTransactionsTable) return [];
    return filterAllTxMetaToListed(allTransactionsRowMeta, filteredListed);
  }, [isAllTransactionsTable, filteredListed, allTransactionsRowMeta]);

  const partyProgressByTask = useQueuePartyProgress({
    enabled: showPartyColumns,
    listed,
    listedTaskIdsKey,
    tasks,
    infoRolesMatrix,
  });

  useEffect(() => {
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
    setShowCompleted(false);
  }, [config.pageId]);

  /*
   * Pager numbers straight off the envelope. `totalCount` is the actor's total
   * for the filters and the search; the four rules §2 keeps in the browser run
   * after the page is cut, so the range is reported from what actually rendered.
   */
  const pagination = useMemo(
    () =>
      paged
        ? queuePagination({
            totalCount: pageQuery.data?.totalCount ?? 0,
            page,
            pageSize: pageQuery.data?.pageSize ?? QUEUE_PAGE_SIZE,
            totalPages: pageQuery.data?.totalPages ?? 1,
            shownOnPage: filteredListed.length,
          })
        : null,
    [paged, pageQuery.data, page, filteredListed.length],
  );

  return {
    selectedId,
    role,
    staffUsers,
    needsInspectionWorkspaces,
    tasks,
    refetchTasks,
    refetchPoRecords,
    refreshPartySubmissions,
    now,
    isDesktopViewport,
    flags,
    paged,
    pagination,
    page,
    setPage,
    isPagePlaceholder: paged && pageQuery.isPlaceholderData,
    queueLoadError,
    queueErrorMessage,
    queueReady,
    queuePending,
    retryQueueLoad,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    showCompleted,
    setShowCompleted,
    poByNumber,
    listed,
    selectedTask,
    resolveTaskBadge,
    allTransactionsRowMeta,
    filteredListed,
    filteredPrimaryMeta,
    filteredAllTxMeta,
    partyProgressByTask,
    primaryHasLocation,
    assignmentTypes,
    statusOptions,
  };
}

export type ActiveTransactionQueueData = ReturnType<
  typeof useActiveTransactionQueueData
>;
