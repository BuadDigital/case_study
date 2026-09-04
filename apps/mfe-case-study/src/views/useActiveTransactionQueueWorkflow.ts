"use client";

/**
 * All non-rendering behaviour of `ActiveTransactionQueueView`: queue and PO
 * loading, viewer scoping, filters, row meta, the open/refresh/copy commands and
 * the queue api exposed to hosts. The view consumes the returned bag and keeps
 * JSX only; the pure projections live in `active-transaction-queue-state`.
 */
import type { MutableRefObject } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { getAuthSession } from "@platform/auth-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  getCachedPartySubmission,
  partySubmissionTaskIdsKey,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  usePoRecordsQuery,
  useWorkflowTasksFilteredQuery,
} from "@case-study/mfe/query/case-study-queries";
import { buildActiveQueueRowMoreItems } from "../lib/app-data/active-queue-row-menu";
import { buildCopyPriorTargetOptions } from "../lib/app-data/po-intake-model";
import {
  computePartyCaseStudyProgress,
  loadPartyCaseStudyAnswersByParty,
} from "../lib/app-data/case-study-party-progress";
import { PARTY_CASE_STUDY_FORM_CHANGED_EVENT } from "../lib/app-data/case-study-form-model";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import { skipsBourseForIdentifier } from "../lib/app-data/po-intake-data";
import {
  TASKS_CHANGED_EVENT,
  type WorkflowTask,
} from "../lib/app-data/tasks-storage";
import { resolveQueueTasksForViewer } from "../lib/app-data/viewer-task-access";
import {
  buildRowAttentionFingerprint,
  rowHasAttentionDot,
} from "../lib/app-data/row-attention-model";
import { useRowAttentionSeenMap } from "../lib/app-data/use-row-attention-seen-map";
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
import type {
  PartyProgressByTask,
  QueueRowContext,
} from "./active-transaction-queue-tables";
import {
  buildAllTxPoGroups,
  buildListedQueue,
  buildPoByNumber,
  buildQueueFilterOptions,
  buildQueueServerQuery,
  filterAppraisalRowMeta,
  resolveQueueLayoutFlags,
  type ActiveQueueApi,
  type ActiveQueueRowMoreContext,
  type ActiveTransactionQueueConfig,
} from "./active-transaction-queue-state";
import { buildQueueMobileCardItems } from "./active-transaction-queue-cards";

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
// Prefetch on hover/focus of queue rows — the row opens an Infath step
// in the work screen, and its chunk was only fetched after click (bundle-preload).
const preloadPoPropertyEnfathForm = () =>
  void import("@case-study/mfe/components/po-intake/PoPropertyEnfathForm");

export function useActiveTransactionQueueWorkflow({
  config,
  queueApiRef,
}: {
  config: ActiveTransactionQueueConfig;
  queueApiRef?: MutableRefObject<ActiveQueueApi | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const selectedId = searchParams.get("task");
  const [isOpeningTask, startOpenTask] = useTransition();
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
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
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedId));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [groupByPo, setGroupByPo] = useState(false);
  const [groupGatherAnim, setGroupGatherAnim] = useState(false);
  const groupGatherTimerRef = useRef<number | null>(null);
  const [collapsedPo, setCollapsedPo] = useState<Record<string, boolean>>({});
  const advancingRef = useRef(false);
  const [, bump] = useState(0);
  const [submissionCacheGen, setSubmissionCacheGen] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyPoNumber, setCopyPoNumber] = useState("");
  const [copyTargetKey, setCopyTargetKey] = useState<string | null>(null);
  const [partyProgressRevision, setPartyProgressRevision] = useState(0);
  const [partyProgressByTask, setPartyProgressByTask] =
    useState<PartyProgressByTask>(() => new Map());

  const flags = useMemo(() => resolveQueueLayoutFlags(config), [config]);
  const {
    isPropertyInspectionQueue,
    isDistributionTable,
    isAllTransactionsTable,
    isEngineeringSurveyTable,
    isPropertyAppraisalTable,
    isPartyQueueToggleTable,
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
  const queueServerQuery = useMemo(
    () =>
      buildQueueServerQuery({
        config,
        role,
        showCompleted,
        narrow: !needsSiblingTasks,
      }),
    [config, role, showCompleted, needsSiblingTasks],
  );
  const {
    data: tasks,
    refetch: refetchTasks,
    isFetched: tasksFetched,
    isError: tasksError,
    error: tasksQueryError,
  } = useWorkflowTasksFilteredQuery(queueServerQuery, { live: true });
  const queueLoadError = tasksError || poRecordsError;
  const queueErrorMessage =
    (tasksQueryError instanceof Error ? tasksQueryError.message : null) ??
    (poRecordsQueryError instanceof Error ? poRecordsQueryError.message : null) ??
    "تعذّر تحميل قائمة المعاملات";
  const queueReady = tasksFetched && poRecordsFetched && !queueLoadError;
  const queuePending = !tasksFetched || !poRecordsFetched;

  const retryQueueLoad = useCallback(() => {
    void refetchPoRecords();
    void refetchTasks();
  }, [refetchPoRecords, refetchTasks]);

  const refreshWork = useCallback(() => {
    bump((n) => n + 1);
    if (needsPartySubmissions) {
      setSubmissionCacheGen((n) => n + 1);
    }
    void refetchTasks();
    void refetchPoRecords();
    if (config.allowPhaseRevert) {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.pendingBourseItems(),
      });
    }
    if (needsInspectionWorkspaces) {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.fieldInspectionWorkspaces(),
      });
    }
  }, [
    refetchTasks,
    refetchPoRecords,
    queryClient,
    needsInspectionWorkspaces,
    needsPartySubmissions,
    config.allowPhaseRevert,
  ]);

  const syncQueue = useCallback(async () => {
    // Independent keys in parallel; invalidating workflowTasks refetches on its own —
    // the extra refetchTasks was a duplicate identical GET (async-parallel).
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: appDataKeys.poRecords() }),
      queryClient.invalidateQueries({ queryKey: appDataKeys.workflowTasks() }),
    ];
    if (config.allowPhaseRevert) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: appDataKeys.pendingBourseItems(),
        }),
      );
    }
    if (needsInspectionWorkspaces) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: appDataKeys.fieldInspectionWorkspaces(),
        }),
      );
    }
    await Promise.all(invalidations);
    bump((n) => n + 1);
  }, [
    queryClient,
    refetchTasks,
    needsInspectionWorkspaces,
    config.allowPhaseRevert,
  ]);

  useEffect(() => {
    const events = config.refreshOnWindowEvents;
    if (!events?.length) return;
    // TASKS_CHANGED must not call refetchPoRecords: that re-runs sync and
    // notifyTasksChanged, which would loop while this queue is open.
    const handler = (ev: Event) => {
      if (ev.type === TASKS_CHANGED_EVENT) {
        bump((n) => n + 1);
        if (needsPartySubmissions) {
          setSubmissionCacheGen((n) => n + 1);
        }
        void refetchTasks();
        return;
      }
      refreshWork();
    };
    for (const ev of events) window.addEventListener(ev, handler);
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler);
    };
  }, [
    config.refreshOnWindowEvents,
    refreshWork,
    refetchTasks,
    needsPartySubmissions,
  ]);

  useEffect(() => {
    if (selectedId) setPanelOpen(true);
    else setPanelOpen(false);
  }, [selectedId]);

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

  const closePanel = useCallback(() => {
    router.replace(config.getBasePath(), { scroll: false });
  }, [router, config]);

  useEffect(() => {
    if (!selectedId || !queueReady) return;
    if (!listed.some((t) => t.id === selectedId)) {
      closePanel();
    }
  }, [selectedId, listed, queueReady, closePanel]);

  const useFullPage = Boolean(
    config.fullPageTaskPath || config.resolveFullPageTaskPath,
  );

  const resolveTaskFullPagePath = useCallback(
    (task: WorkflowTask): string | undefined => {
      const perTask = config.resolveFullPageTaskPath?.(task);
      if (perTask) return perTask;
      if (config.fullPageTaskPath) return config.fullPageTaskPath(task.id);
      return undefined;
    },
    [config],
  );

  const openTask = useCallback(
    (taskId: string, task?: WorkflowTask) => {
      const fullPath = task ? resolveTaskFullPagePath(task) : undefined;
      if (fullPath) {
        router.push(fullPath);
        return;
      }
      if (config.fullPageTaskPath) {
        router.push(config.fullPageTaskPath(taskId));
        return;
      }
      setPanelOpen(true);
      router.replace(config.getTaskPath(taskId), { scroll: false });
    },
    [router, config, resolveTaskFullPagePath],
  );

  const resolveTaskBadge = useCallback(
    (task: WorkflowTask) =>
      resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
        partySubmission: getCachedPartySubmission(task.id),
      }),
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
  );

  const [rowAttentionSeen, markRowAttentionSeen] = useRowAttentionSeenMap();

  /** Outlook-style unread dot: new task, status change, or badge change
   * (return / reply / new action) that the row hasn't been opened since. */
  const resolveRowAttention = useCallback(
    (task: WorkflowTask): boolean =>
      rowHasAttentionDot(
        task.id,
        buildRowAttentionFingerprint(task, resolveTaskBadge(task)?.className),
        rowAttentionSeen,
      ),
    [resolveTaskBadge, rowAttentionSeen],
  );

  const markTaskRowSeen = useCallback(
    (task: WorkflowTask) => {
      markRowAttentionSeen(
        task.id,
        buildRowAttentionFingerprint(task, resolveTaskBadge(task)?.className),
      );
    },
    [markRowAttentionSeen, resolveTaskBadge],
  );

  const handleRowClick = useCallback(
    (taskId: string) => {
      const task = listed.find((t) => t.id === taskId);
      if (task && config.canOpenTask && !config.canOpenTask(task)) return;
      if (task) markTaskRowSeen(task);

      const fullPath = task ? resolveTaskFullPagePath(task) : undefined;
      // Closing the open row should not flash a loading state.
      if (!fullPath && !useFullPage && selectedId === taskId) {
        setOpeningTaskId(null);
        closePanel();
        return;
      }

      setOpeningTaskId(taskId);
      startOpenTask(() => {
        if (fullPath) {
          router.push(fullPath);
          return;
        }
        if (useFullPage) {
          openTask(taskId, task);
          return;
        }
        openTask(taskId);
      });
    },
    [
      useFullPage,
      selectedId,
      closePanel,
      openTask,
      listed,
      config,
      resolveTaskFullPagePath,
      router,
      markTaskRowSeen,
    ],
  );

  useEffect(() => {
    if (selectedId && selectedId === openingTaskId) {
      // Keep spinner visible briefly so the open feels intentional.
      const t = window.setTimeout(() => setOpeningTaskId(null), 280);
      return () => window.clearTimeout(t);
    }
  }, [selectedId, openingTaskId]);

  useEffect(() => {
    if (isOpeningTask || !openingTaskId) return;
    // Full-page navigation or transition end: clear after a short dwell.
    const t = window.setTimeout(() => {
      setOpeningTaskId((id) => (id === openingTaskId ? null : id));
    }, 400);
    return () => window.clearTimeout(t);
  }, [isOpeningTask, openingTaskId]);

  const isTaskOpening = useCallback(
    (taskId: string) => openingTaskId === taskId,
    [openingTaskId],
  );

  const resolveRowMoreItems = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      const record = poByNumber.get(task.poNumber.trim());
      const property = findPropertyForTask(record, task);
      const openCopyFromPrior = () => {
        const key = propertyId?.trim()
          ? `property:${propertyId.trim()}`
          : `slot:${task.id}`;
        setCopyPoNumber(task.poNumber.trim());
        setCopyTargetKey(key);
        setCopyModalOpen(true);
      };
      const ctx: ActiveQueueRowMoreContext = {
        task,
        propertyId,
        openTask: () => handleRowClick(task.id),
        router,
        refreshQueue: refreshWork,
        showToast,
        poByNumber,
        viewerRole: role,
      };
      if (config.buildRowMoreItems) {
        return config.buildRowMoreItems(ctx);
      }
      return buildActiveQueueRowMoreItems({
        ...ctx,
        allowPhaseRevert: Boolean(config.allowPhaseRevert),
        skipsBourse: property
          ? skipsBourseForIdentifier(property.identifierType)
          : false,
        onCopyFromPrior: config.allowCopyFromPrior
          ? openCopyFromPrior
          : undefined,
        allowDeleteTransaction: Boolean(config.allowDeleteTransaction),
        viewerRole: role,
      });
    },
    [
      config,
      handleRowClick,
      router,
      refreshWork,
      showToast,
      poByNumber,
      role,
    ],
  );

  const copyTargets = useMemo(() => {
    if (!copyPoNumber) return [];
    const record = poByNumber.get(copyPoNumber);
    if (!record) return [];
    return buildCopyPriorTargetOptions(record, tasks ?? []);
  }, [copyPoNumber, poByNumber, tasks]);

  const handleCopiedFromPrior = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.poRecord(copyPoNumber),
    });
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.poRecords(),
    });
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.workflowTasks(),
    });
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.pendingBourseItems(),
    });
    refreshWork();
  }, [queryClient, copyPoNumber, refreshWork]);

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

  // Rows in these two branches open the transaction work screen that starts with the Infath form.
  const preloadRowWork =
    isAllTransactionsTable ||
    (!isDistributionTable && !isPartyQueueToggleTable)
      ? preloadPoPropertyEnfathForm
      : undefined;

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
      }),
    [flags, allTransactionsRowMeta, distributionRowMeta, primaryRowMeta],
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
    return filterPrimaryQueueRowMeta(primaryRowMeta, {
      search: deferredSearch,
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
    const ids = new Set(filteredListed.map((t) => t.id));
    return allTransactionsRowMeta.filter((row) => ids.has(row.task.id));
  }, [isAllTransactionsTable, filteredListed, allTransactionsRowMeta]);

  const allTxPoGroups = useMemo(() => {
    if (!isAllTransactionsTable || !groupByPo) return [];
    return buildAllTxPoGroups(filteredAllTxMeta);
  }, [isAllTransactionsTable, groupByPo, filteredAllTxMeta]);

  const toggleGroupByPo = useCallback(() => {
    setGroupByPo((prev) => {
      const next = !prev;
      if (next) {
        const collapsed: Record<string, boolean> = {};
        for (const row of allTransactionsRowMeta) {
          collapsed[row.poNumber] = true;
        }
        setCollapsedPo(collapsed);
        if (groupGatherTimerRef.current != null) {
          window.clearTimeout(groupGatherTimerRef.current);
        }
        setGroupGatherAnim(true);
        groupGatherTimerRef.current = window.setTimeout(() => {
          setGroupGatherAnim(false);
          groupGatherTimerRef.current = null;
        }, 520);
      }
      return next;
    });
  }, [allTransactionsRowMeta]);

  useEffect(() => {
    return () => {
      if (groupGatherTimerRef.current != null) {
        window.clearTimeout(groupGatherTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const refresh = () => setPartyProgressRevision((revision) => revision + 1);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!showPartyColumns || !tasks) {
      // Avoid a new Map() every run — that re-renders and can loop when deps churn.
      setPartyProgressByTask((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }

    let cancelled = false;
    void Promise.all(
      listed.map(async (parent) => {
        try {
          const answers = await loadPartyCaseStudyAnswersByParty(parent, tasks);
          const rows = computePartyCaseStudyProgress(
            infoRolesMatrix,
            answers,
            { includeSpecialistAnswers: false },
          );
          const progress: Partial<Record<CaseStudyInfoPartyId, number>> = {};
          for (const row of rows) progress[row.partyId] = row.pct;
          return [parent.id, progress] as const;
        } catch {
          return [
            parent.id,
            {} as Partial<Record<CaseStudyInfoPartyId, number>>,
          ] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setPartyProgressByTask(new Map(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [
    showPartyColumns,
    // Prefer id key over `listed` identity — a fresh array each render was looping with setState.
    listedTaskIdsKey,
    tasks,
    infoRolesMatrix,
    partyProgressRevision,
  ]);

  useEffect(() => {
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
    setShowCompleted(false);
  }, [config.pageId]);

  useEffect(() => {
    if (!queueApiRef) return;
    queueApiRef.current = {
      listed,
      poByNumber,
      openTask,
      closePanel,
      setAdvancing: (value) => {
        advancingRef.current = value;
      },
      syncQueue,
    };
  }, [queueApiRef, listed, poByNumber, openTask, closePanel, syncQueue]);

  useEffect(() => {
    if (advancingRef.current) return;
    if (!selectedId || queuePending) return;
    if (selectedTask) return;
    const stillExists = (tasks ?? []).some((t) => t.id === selectedId);
    if (!stillExists || listed.every((t) => t.id !== selectedId)) {
      closePanel();
    }
  }, [selectedId, selectedTask, queuePending, listed, closePanel, tasks]);

  useEffect(() => {
    if (!selectedTask) return;
    markTaskRowSeen(selectedTask);
  }, [selectedTask, markTaskRowSeen]);

  /* A fresh literal object each render broke row memoization despite stable handlers —
     the screen re-renders on search keystrokes, minute ticks, and every bump (rerender-memo). */
  const rowCtx: QueueRowContext = useMemo(
    () => ({
      queuePending,
      showSkeleton: queuePending && listed.length === 0,
      selectedId,
      isTaskOpening,
      handleRowClick,
      resolveRowAttention,
      resolveRowMoreItems,
    }),
    [
      queuePending,
      listed.length,
      selectedId,
      isTaskOpening,
      handleRowClick,
      resolveRowAttention,
      resolveRowMoreItems,
    ],
  );

  const openPropertyDetailFromQueue = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      if (!propertyId) return;
      markTaskRowSeen(task);
      setOpeningTaskId(task.id);
      startOpenTask(() => {
        router.push(poPropertyDetailPath(task.poNumber, propertyId, "basic"));
      });
    },
    [router, markTaskRowSeen],
  );

  const handleDistributionRowClick = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      markTaskRowSeen(task);
      if (showPartyColumns && propertyId) {
        openPropertyDetailFromQueue(task, propertyId);
        return;
      }
      handleRowClick(task.id);
    },
    [
      showPartyColumns,
      handleRowClick,
      markTaskRowSeen,
      openPropertyDetailFromQueue,
    ],
  );

  const mobileQueueCardItems = useMemo(() => {
    // Mobile tree does not mount on desktop — no need to build its elements.
    if (isDesktopViewport === true) return [];
    if (isPropertyInspectionQueue) return [];
    return buildQueueMobileCardItems({
      flags,
      disableRowOpen: Boolean(config.disableRowOpen),
      filteredAllTxMeta,
      filteredListed,
      filteredPrimaryMeta,
      poByNumber,
      now,
      resolveRowMoreItems,
      resolveTaskBadge,
      handleRowClick,
      handleDistributionRowClick,
      isTaskOpening,
    });
  }, [
    isDesktopViewport,
    isPropertyInspectionQueue,
    flags,
    filteredAllTxMeta,
    filteredListed,
    filteredPrimaryMeta,
    poByNumber,
    now,
    resolveRowMoreItems,
    resolveTaskBadge,
    handleRowClick,
    handleDistributionRowClick,
    isTaskOpening,
    config.disableRowOpen,
  ]);

  return {
    router,
    tasks,
    staffUsers,
    now,
    isDesktopViewport,
    queueLoadError,
    queueErrorMessage,
    queueReady,
    queuePending,
    retryQueueLoad,
    panelOpen,
    selectedTask,
    listed,
    filteredListed,
    filteredPrimaryMeta,
    filteredAllTxMeta,
    allTxPoGroups,
    poByNumber,
    partyProgressByTask,
    primaryHasLocation,
    assignmentTypes,
    statusOptions,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    showCompleted,
    setShowCompleted,
    groupByPo,
    groupGatherAnim,
    toggleGroupByPo,
    collapsedPo,
    setCollapsedPo,
    isPropertyInspectionQueue,
    isDistributionTable,
    isAllTransactionsTable,
    isEngineeringSurveyTable,
    isPropertyAppraisalTable,
    isPartyQueueToggleTable,
    showPartyColumns,
    preloadRowWork,
    useFullPage,
    rowCtx,
    resolveTaskBadge,
    resolveRowMoreItems,
    isTaskOpening,
    handleRowClick,
    handleDistributionRowClick,
    openPropertyDetailFromQueue,
    mobileQueueCardItems,
    refreshWork,
    closePanel,
    copyModalOpen,
    setCopyModalOpen,
    copyPoNumber,
    setCopyPoNumber,
    copyTargets,
    copyTargetKey,
    setCopyTargetKey,
    handleCopiedFromPrior,
  };
}
