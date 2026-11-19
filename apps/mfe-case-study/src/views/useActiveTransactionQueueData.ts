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
import { listPagerWindow } from "@platform/ui-kit";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { transactionProgress } from "../lib/app-data/my-work-model";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { getAuthSession } from "@platform/auth-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import { partySubmissionTaskIdsKey } from "@platform/app-shared/app-data/party-submission-api";
import {
  usePoRecordsQuery,
  useWorkflowTasksFilteredQuery,
  useWorkflowTasksPageQuery,
} from "@case-study/mfe/query/case-study-queries";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
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
  closedTransactionProgress,
  filterAllTransactionsQueueRows,
} from "../lib/app-data/all-transactions-queue";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import { useQueuePartyProgress } from "./useQueuePartyProgress";
import {
  allTxRowsForStatusFilter,
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
import { WorkflowTaskKinds } from "@platform/app-shared/workflow/task-types";

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
  const { role, viewerUserId, distributionAssigneeId } = useAppAccess();
  const { data: staffResult } = useStaffUsersQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
  const needsInspectionWorkspaces = Boolean(config.getTaskStatusBadge);
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
   * slice (pagination-contract, "still client-side" #1 and #3). Those three
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
  // Also built for the other «show completed» position, so hovering the toggle can warm it.
  const serverQueryFor = useCallback(
    (completed: boolean) =>
      buildQueueServerQuery({
        config,
        role,
        showCompleted: completed,
        narrow: !needsSiblingTasks,
        search: paged ? debouncedSearch : undefined,
      }),
    [config, role, needsSiblingTasks, paged, debouncedSearch],
  );
  const queueServerQuery = useMemo(
    () => serverQueryFor(showCompleted),
    [serverQueryFor, showCompleted],
  );
  const queuePageQuery = useMemo(
    () => buildQueuePageQuery({ filters: queueServerQuery, page }),
    [queueServerQuery, page],
  );
  // Any change to the filters or the search resets to page 1 — page 3 of the old
  // query is never page 3 of the new one.
  const serverQueryKey = JSON.stringify(queueServerQuery);
  const [pagedQueryKey, setPagedQueryKey] = useState(serverQueryKey);
  if (pagedQueryKey !== serverQueryKey) {
    setPagedQueryKey(serverQueryKey);
    setPage(1);
  }
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
    isPlaceholderData: tasksPlaceholder,
    isError: tasksError,
    error: tasksQueryError,
  } = paged
    ? {
        data: pageQuery.data?.rows,
        refetch: pageQuery.refetch,
        isFetched: pageQuery.isFetched,
        isPlaceholderData: pageQuery.isPlaceholderData,
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
  // `isFetched` is per key, so a filter / page / search change drops `queueReady`
  // while the previous rows stay on screen (keepPreviousData). The toolbar, the
  // rail and the empty state read this instead, so they do not blink out.
  const queueShowsRows =
    (tasksFetched || tasksPlaceholder) && poRecordsFetched && !queueLoadError;

  const retryQueueLoad = useCallback(() => {
    void refetchPoRecords();
    void refetchTasks();
  }, [refetchPoRecords, refetchTasks]);

  /**
   * Kept for the commands that call it after a refresh. The badges no longer read party submissions
   * (2026-11-15), so there is nothing to re-resolve.
   */
  const refreshPartySubmissions = useCallback(() => {}, []);

  const poByNumber = useMemo(() => buildPoByNumber(poRecords), [poRecords]);

  const mine = useMemo(() => {
    return resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId: config.pageId,
      partyAssignee: config.partyAssignee,
      assigneeRole: config.assigneeRole,
      viewerUserId: viewerUserId ?? getAuthSession()?.user.id,
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });
  }, [
    config.assigneeRole,
    config.pageId,
    config.partyAssignee,
    viewerUserId,
    distributionAssigneeId,
    role,
    tasks,
    staffUsers,
  ]);

  const listed = useMemo(
    () =>
      buildListedQueue({
        config,
        mine,
        allTasks: tasks ?? EMPTY_TASKS,
        poByNumber,
        showCompleted,
      }),
    [config, mine, tasks, poByNumber, showCompleted],
  );

  const listedTaskIdsKey = useMemo(
    () => partySubmissionTaskIdsKey(listed.map((t) => t.id)),
    [listed],
  );

  // The appraiser queue's finer labels (draft sent / approved) and «المعاملات النشطة»'s «بانتظار»
  // after the study is issued come from the valuation service.
  const tracksProgress = isAllTransactionsTable && !config.partyAssignee;
  const draftStateVersion = useReportDraftStates(
    isPropertyAppraisalTable
      ? listed.map((t) => t.propertyId)
      : // Only issued, not handed-over studies have a draft to read (the batch read caps at 200 ids).
        listed
          .filter((t) => t.kind === WorkflowTaskKinds.CaseStudyProperty && t.studyReportIssued && !t.propertyHandedOverToEnfaz)
          .map((t) => t.propertyId),
    isPropertyAppraisalTable || tracksProgress,
  );

  const selectedTask = useMemo((): WorkflowTask | null => {
    if (!selectedId) return null;
    return listed.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, listed]);

  // The badges come from the task itself (and the inspection workspace) — no party submission is read.
  // 2026-11-15: every listed task's full submission was downloaded here for a badge that ignored it —
  // 4 MB per open of «جميع العقارات», and again on every task-list refresh.
  const resolveTaskBadge = useCallback(
    (task: WorkflowTask) =>
      resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
      }),
    [config, inspectionWorkspaceByTaskId],
  );

  const allTransactionsRowMeta = useMemo(() => {
    if (!isAllTransactionsTable) return [];
    if (!tracksProgress) return buildAllTransactionsQueueRowMeta(listed, poByNumber, now);
    void draftStateVersion;
    const all = tasks ?? EMPTY_TASKS;
    const byId = new Map(all.map((t) => [t.id, t]));
    // The row may stand on a party task (its latest stage) — progress is read on its case-study parent.
    const progressOf = (task: WorkflowTask) => {
      const parent = task.kind === WorkflowTaskKinds.CaseStudyProperty ? task : byId.get(task.parentTaskId ?? "");
      // «جميع العقارات» (Omar 2026-11-15): the uploaded and the cancelled stay listed, as closed rows.
      return parent
        ? (transactionProgress(parent, all, getReportDraftState) ?? closedTransactionProgress(parent))
        : null;
    };
    return buildAllTransactionsQueueRowMeta(listed, poByNumber, now, progressOf);
  }, [isAllTransactionsTable, tracksProgress, listed, poByNumber, now, tasks, draftStateVersion]);

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
        draftStateVersion,
      });
    }
    // No search pass: this queue pages, and the server already matched `q`
    // against the deed / city / district haystack (pagination-contract).
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
    draftStateVersion,
  ]);

  const filteredListed = useMemo(() => {
    if (isAllTransactionsTable) {
      // A party option keeps the rows waiting at that party; a phase option filters by phase.
      const byStatus = allTxRowsForStatusFilter(allTransactionsRowMeta, statusFilter);
      return filterAllTransactionsQueueRows(byStatus.rows, {
        search: deferredSearch,
        statusFilter: byStatus.phaseFilter,
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

  // «جميع العقارات» pages in the browser — its rows are filtered here, not by the server — 25 a page,
  // like «أعمالي» (Omar 2026-11-15). A new search or filter starts again at page 1; a page past the
  // end (rows gone) is pulled back by listPagerWindow.
  const allTxFilterKey = `${deferredSearch}|${statusFilter}|${typeFilter}|${showCompleted}`;
  const [allTxPagedFor, setAllTxPagedFor] = useState(allTxFilterKey);
  if (isAllTransactionsTable && allTxPagedFor !== allTxFilterKey) {
    setAllTxPagedFor(allTxFilterKey);
    setPage(1);
  }
  const allTxWindow = listPagerWindow({
    page,
    pageSize: QUEUE_PAGE_SIZE,
    totalCount: filteredAllTxMeta.length,
  });
  const allTxPageMeta = useMemo(
    () =>
      filteredAllTxMeta.slice(
        (allTxWindow.safePage - 1) * QUEUE_PAGE_SIZE,
        allTxWindow.safePage * QUEUE_PAGE_SIZE,
      ),
    [filteredAllTxMeta, allTxWindow.safePage],
  );

  const partyProgressByTask = useQueuePartyProgress({
    enabled: showPartyColumns,
    listed,
    listedTaskIdsKey,
    tasks,
    infoRolesMatrix,
  });

  // Moving to another queue page starts from clean filters — adjusted during
  // render so the new page never paints the previous page’s filters first.
  const [filtersForPage, setFiltersForPage] = useState(config.pageId);
  if (filtersForPage !== config.pageId) {
    setFiltersForPage(config.pageId);
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
    setShowCompleted(false);
  }

  /*
   * Pager numbers straight off the envelope. `totalCount` is the actor's total
   * for the filters and the search; the four rules section 2 keeps in the browser run
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
    tasksPlaceholder,
    serverQueryFor,
    queueShowsRows,
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
    allTxPageMeta,
    allTxWindow,
    partyProgressByTask,
    primaryHasLocation,
    assignmentTypes,
    statusOptions,
  };
}

export type ActiveTransactionQueueData = ReturnType<
  typeof useActiveTransactionQueueData
>;
