"use client";

/**
 * Read half of `useOperationsTasksWorkflow`: the staff / PO / task queries,
 * the query reducer, the queue projections, the selection and detail state
 * and everything derived from them. The writes live in
 * `useOperationsTasksCommands` and `useOperationsTasksAssignmentCommands`;
 * this hook owns the state they mutate.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useShowAllEyeBlink } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  useStaffUsersQuery,
  useDistributionAssigneesQuery,
} from "@settings/mfe/query/settings-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { usePoRecordsQuery } from "../query/case-study-queries";
import { loadOperationsTasks } from "../lib/app-data/operations-tasks-reads";
import {
  useOperationsTasksFilteredQuery,
  useOperationsTaskStatusCounts,
} from "../query/operations-tasks-queries";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/app-data/operations-tasks-model";
import {
  canManageOperationsTasks,
  canRemindOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../lib/app-data/operations-task-roles";
import { failureTargetsForOperationsTask } from "../lib/app-data/operations-task-failure-targets";
import { isOperationsTaskBlockedByFailure } from "../lib/app-data/operations-task-failure-obstruction";
import {
  partyAccountForRole,
  partyAccountForViewer,
} from "../lib/app-data/distribution-parties";
import type { CreateOperationsTaskPrefill } from "../components/CreateOperationsTaskModal";
import { assigneesForType } from "./OperationsTasksViewShared";
import {
  creditAssigneeOptions,
  matchesOperationsTaskAssignee,
  operationsTaskHiddenByFailure,
  INITIAL_OPERATIONS_TASK_QUERY,
  operationsTaskQueryReducer,
  toOperationsTaskListQuery,
  queueTasksForViewer,
  reviewerStaffForAccount,
  visibleOperationsTasks,
} from "./operations-tasks-view-state";

export function useOperationsTasksData() {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task")?.trim() || null;
  const createFlag = searchParams.get("create");
  const prefillPo = searchParams.get("po")?.trim() || undefined;
  const prefillType = searchParams.get("type")?.trim() || undefined;
  const prefillScope = searchParams.get("scope")?.trim() || undefined;
  const prefillDeed = searchParams.get("deed")?.trim() || undefined;

  const { role, viewerUserId, viewerDisplayName } = useAppAccess();
  const { data: staffResult, isPending: staffPending } = useStaffUsersQuery();
  const { data: distResult, isPending: distPending } =
    useDistributionAssigneesQuery();
  const staffUsers = useMemo(() => {
    const byId = new Map<string, StaffUser>();
    for (const u of staffResult?.users ?? []) byId.set(u.id, u);
    for (const u of distResult?.users ?? []) {
      if (!byId.has(u.id)) byId.set(u.id, u);
    }
    return [...byId.values()];
  }, [staffResult?.users, distResult?.users]);
  const staffLoadError =
    staffResult?.loadError ?? distResult?.loadError ?? null;
  const staffLoading = staffPending || distPending;
  const { data: poRecords = [] } = usePoRecordsQuery();

  const canCreate = canManageOperationsTasks(role);
  const canRemind = canRemindOperationsTasks(role);
  const useIndependentQueue = operationsTasksUseAssigneeScope(role);

  /** Viewer account for executor queues (assignee-scoped), fallback to role prototype seed. */
  const partyAccount = useMemo(
    () =>
      partyAccountForViewer(role, viewerUserId, staffUsers) ??
      partyAccountForRole(role, staffUsers),
    [role, viewerUserId, staffUsers],
  );

  /** Keep local name used by court/credit UI that expects government-reviewer account. */
  const reviewerAccount = partyAccount;

  const assigneeScopeId = useIndependentQueue
    ? partyAccount?.assigneeId?.trim() || undefined
    : undefined;

  const [query, dispatchQuery] = useReducer(
    operationsTaskQueryReducer,
    INITIAL_OPERATIONS_TASK_QUERY,
  );
  const { search, statusFilter, scopeFilter, showAll } = query;
  const setSearch = (value: string) => dispatchQuery({ type: "search", value });
  const setStatusFilter = (value: string) =>
    dispatchQuery({ type: "status", value });
  const setScopeFilter = (value: string) =>
    dispatchQuery({ type: "scope", value });
  const setShowAll = (value: boolean | ((prev: boolean) => boolean)) =>
    dispatchQuery({
      type: "showAll",
      value: typeof value === "function" ? value(query.showAll) : value,
    });
  const { blink: showAllEyeBlink, toggleOpen: toggleShowAll, triggerBlink } =
    useShowAllEyeBlink();

  // The search box drives a server request now — debounce it instead of
  // deferring a local pass, so typing does not fire one GET per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);
  const serverQueryFor = useCallback(
    (state: typeof query) =>
      toOperationsTaskListQuery(state, {
        assigneeId: assigneeScopeId,
        // The pause-reason half of the hidden-by-failure rule is a column the
        // endpoint can answer; the rest stays in `queueTasksForViewer`.
        excludeFailurePaused: useIndependentQueue,
        search: debouncedSearch,
      }),
    [assigneeScopeId, useIndependentQueue, debouncedSearch],
  );
  const serverQuery = useMemo(
    () => serverQueryFor(query),
    [serverQueryFor, query],
  );

  const {
    data: tasks = [],
    isPending,
    isPlaceholderData,
    refetch,
    isFetching,
  } = useOperationsTasksFilteredQuery(serverQuery, { live: true });

  // Pointer on «إظهار جميع المهام» — warm the other slice (same key as the list query).
  const queryClient = useQueryClient();
  const prefetchShowAllToggle = useCallback(() => {
    const next = serverQueryFor({ ...query, showAll: !query.showAll });
    void queryClient.prefetchQuery({
      queryKey: appDataKeys.operationsTasksFiltered(next),
      queryFn: () => loadOperationsTasks(next),
      staleTime: 30_000,
    });
  }, [queryClient, serverQueryFor, query]);

  /*
   * Swap-fade key for the list, held while the previous rows stand in for a new
   * server slice so the fade plays when the new rows land. Search is left out —
   * typing must not pulse the table.
   */
  const listFilterKey = `${query.statusFilter}|${query.scopeFilter}|${query.showAll}`;
  const [listSwapKey, setListSwapKey] = useState(listFilterKey);
  if (!isPlaceholderData && listSwapKey !== listFilterKey) {
    setListSwapKey(listFilterKey);
  }
  /*
   * The auto-resume sweep needs the paused rows, which the queue's own filters
   * hide (`activeOnly`, `excludeFailurePaused`) — pagination-contract §3,
   * "still client-side" #4. One narrow `status=paused` request instead of
   * re-loading the whole queue.
   */
  const { data: pausedTasks = [], refetch: refetchPaused } =
    useOperationsTasksFilteredQuery({
      ...(assigneeScopeId ? { assigneeId: assigneeScopeId } : {}),
      status: "paused",
    });
  const { data: failures = [] } = useFailuresQuery();
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkTaskId);
  const [detailId, setDetailId] = useState<string | null>(deepLinkTaskId);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateOperationsTaskPrefill | null>(
    null,
  );
  // Minute precision is enough for screen logic — per-second timers (DueCell and mobile cards)
  // subscribe to the clock themselves, so every row is not rebuilt each second (rerender-defer-reads).
  const now = useTickingMinute();
  // After hydration mount only one tree (table or cards) — both used to be built together.
  const isDesktopViewport = useViewportDesktop();
  const selAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    setSelectedId(deepLinkTaskId);
    setDetailId(deepLinkTaskId);
    // A deep link may point at a row the current filter hides — open the full list
    // and blink the control so the switch is visible. `dispatchQuery` is stable,
    // unlike the `setShowAll` wrapper that closes over the query.
    if (!showAll) {
      triggerBlink();
      dispatchQuery({ type: "showAll", value: true });
    }
  }, [deepLinkTaskId, showAll, triggerBlink]);

  // `?create=1` with its prefill params opens the create modal.
  const createRequested =
    canCreate && (createFlag === "1" || createFlag === "true");
  const [prevCreateRequested, setPrevCreateRequested] = useState(createRequested);
  if (prevCreateRequested !== createRequested) {
    setPrevCreateRequested(createRequested);
    if (createRequested) {
      setCreatePrefill({
        type: prefillType || "general",
        scope:
          prefillScope ||
          (prefillType === "court_visit"
            ? "work_order"
            : prefillPo
              ? "transaction"
              : "work_order"),
        poNumber: prefillPo,
        deed: prefillDeed,
      });
      setCreateOpen(true);
    }
  }

  const queueTasks = useMemo(
    () => queueTasksForViewer(tasks, useIndependentQueue, failures, poRecords),
    [tasks, useIndependentQueue, failures, poRecords],
  );

  // Counted by the endpoint, not over the loaded rows — the list is narrowed
  // server-side now, so `operationsTaskKpis(queueTasks)` would count a slice.
  const kpis = useOperationsTaskStatusCounts({
    assigneeId: assigneeScopeId,
    excludeFailurePaused: useIndependentQueue,
    live: true,
  });

  // No search argument: `q` — deed numbers included — is answered in the query
  // (pagination-contract §3), so the page is rendered as it arrived.
  const visibleTasks = useMemo(
    () =>
      visibleOperationsTasks(queueTasks, {
        statusFilter,
        scopeFilter,
        showAll,
      }),
    [queueTasks, statusFilter, scopeFilter, showAll],
  );

  const detail = useMemo(
    () => (detailId ? tasks.find((t) => t.id === detailId) ?? null : null),
    [tasks, detailId],
  );

  // Deep-link / stale detail must not keep assignee on a failure-blocked task.
  // A task hidden behind a failure closes its panel.
  if (
    useIndependentQueue &&
    detail &&
    operationsTaskHiddenByFailure(detail, failures, poRecords)
  ) {
    setDetailId(null);
    setSelectedId(null);
  }

  const reviewerStaff = useMemo(
    () => reviewerStaffForAccount(reviewerAccount, staffUsers),
    [reviewerAccount, staffUsers],
  );

  // Row handlers stay referentially stable — modal state updates do not break row memo.
  const openTask = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
  }, []);

  const openTaskDetail = useCallback((task: OperationsTask) => {
    setDetailId(task.id);
  }, []);

  const toggleTaskSelected = useCallback((taskId: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (on) next[taskId] = true;
      else delete next[taskId];
      return next;
    });
  }, []);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds],
  );

  const allVisibleActiveChecked = useMemo(() => {
    const active = visibleTasks.filter(isActiveOperationsTask);
    if (active.length === 0) return false;
    return active.every((t) => selectedIds[t.id]);
  }, [visibleTasks, selectedIds]);

  const activeVisible = useMemo(
    () => visibleTasks.filter(isActiveOperationsTask),
    [visibleTasks],
  );
  const selectedActiveCount = useMemo(
    () => activeVisible.filter((t) => selectedIds[t.id]).length,
    [activeVisible, selectedIds],
  );

  useEffect(() => {
    if (!selAllRef.current) return;
    selAllRef.current.indeterminate =
      selectedActiveCount > 0 && selectedActiveCount < activeVisible.length;
  }, [selectedActiveCount, activeVisible.length]);

  const reassignTask = useMemo(() => {
    const id = selectedId ?? detailId;
    return id ? tasks.find((t) => t.id === id) ?? null : null;
  }, [tasks, selectedId, detailId]);

  const reassignAssignees = useMemo(
    () =>
      reassignTask
        ? assigneesForType(reassignTask.type, staffUsers)
        : [],
    [reassignTask, staffUsers],
  );

  const closeTargetTask = useMemo(() => {
    const id = detailId ?? selectedId;
    if (!id) return null;
    return tasks.find((t) => t.id === id) ?? null;
  }, [detailId, selectedId, tasks]);

  const creditAssignees = useMemo(
    () => creditAssigneeOptions(closeTargetTask, staffUsers),
    [closeTargetTask, staffUsers],
  );

  const showCreditPicker = Boolean(
    canCreate && closeTargetTask?.originalAssigneeId,
  );

  const isAssignee = useMemo(() => {
    if (!detail) return false;
    // Executor queue is assignee-scoped — any open task row is theirs.
    if (useIndependentQueue) return true;
    return matchesOperationsTaskAssignee(
      detail,
      reviewerAccount,
      viewerDisplayName,
    );
  }, [detail, reviewerAccount, viewerDisplayName, useIndependentQueue]);

  /** Government reviewer only: raise failures from the task detail (button → modal). */
  const govFailureTargets = useMemo(() => {
    if (role !== "government-reviewer" || !detail) return [];
    return failureTargetsForOperationsTask(detail, poRecords);
  }, [role, detail, poRecords]);

  const showGovFailureRaise =
    role === "government-reviewer" &&
    isAssignee &&
    Boolean(detail) &&
    detail?.status !== "cancelled" &&
    detail?.status !== "completed" &&
    detail?.status !== "paused" &&
    !isOperationsTaskBlockedByFailure(detail!, failures, poRecords);

  return {
    deepLinkTaskId,
    role,
    staffUsers,
    staffLoadError,
    staffLoading,
    poRecords,
    canCreate,
    canRemind,
    useIndependentQueue,
    reviewerAccount,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    scopeFilter,
    setScopeFilter,
    showAll,
    setShowAll,
    showAllEyeBlink,
    toggleShowAll,
    tasks,
    isPending,
    isPlaceholderData,
    isFetching,
    refetch,
    prefetchShowAllToggle,
    listSwapKey,
    pausedTasks,
    refetchPaused,
    failures,
    selectedId,
    setSelectedId,
    detailId,
    setDetailId,
    selectedIds,
    setSelectedIds,
    openTask,
    openTaskDetail,
    toggleTaskSelected,
    createOpen,
    setCreateOpen,
    createPrefill,
    setCreatePrefill,
    now,
    isDesktopViewport,
    selAllRef,
    kpis,
    visibleTasks,
    detail,
    reviewerStaff,
    selectedCount,
    allVisibleActiveChecked,
    reassignTask,
    reassignAssignees,
    creditAssignees,
    showCreditPicker,
    isAssignee,
    govFailureTargets,
    showGovFailureRaise,
  };
}

export type OperationsTasksData = ReturnType<typeof useOperationsTasksData>;
