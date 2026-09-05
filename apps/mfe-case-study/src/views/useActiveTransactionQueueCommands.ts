"use client";

/**
 * Write half of `useActiveTransactionQueueWorkflow`: refresh / sync, the open
 * and close navigation, the row-attention marks, the row "more" menu, the
 * copy-from-prior modal, the PO grouping toggle and the queue api exposed to
 * hosts. It reads the state owned by `useActiveTransactionQueueData`.
 */
import type { MutableRefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { buildActiveQueueRowMoreItems } from "../lib/app-data/active-queue-row-menu";
import { buildCopyPriorTargetOptions } from "../lib/app-data/po-intake-model";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import { skipsBourseForIdentifier } from "../lib/app-data/po-intake-data";
import {
  TASKS_CHANGED_EVENT,
  type WorkflowTask,
} from "../lib/app-data/tasks-storage";
import {
  buildRowAttentionFingerprint,
  rowHasAttentionDot,
} from "../lib/app-data/row-attention-model";
import { useRowAttentionSeenMap } from "../lib/app-data/use-row-attention-seen-map";
import {
  collapseAllPoGroups,
  copyPriorTargetKey,
  queueSelectionIsStale,
  resolveQueueTaskFullPagePath,
  type ActiveQueueApi,
  type ActiveQueueRowMoreContext,
  type ActiveTransactionQueueConfig,
} from "./active-transaction-queue-state";
import type { ActiveTransactionQueueData } from "./useActiveTransactionQueueData";

export function useActiveTransactionQueueCommands({
  config,
  queueApiRef,
  data,
}: {
  config: ActiveTransactionQueueConfig;
  queueApiRef?: MutableRefObject<ActiveQueueApi | null>;
  data: ActiveTransactionQueueData;
}) {
  const {
    selectedId,
    role,
    needsInspectionWorkspaces,
    tasks,
    refetchTasks,
    refetchPoRecords,
    refreshPartySubmissions,
    flags,
    queueReady,
    queuePending,
    poByNumber,
    listed,
    selectedTask,
    resolveTaskBadge,
    allTransactionsRowMeta,
  } = data;
  const { showPartyColumns } = flags;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isOpeningTask, startOpenTask] = useTransition();
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedId));
  const [groupByPo, setGroupByPo] = useState(false);
  const [groupGatherAnim, setGroupGatherAnim] = useState(false);
  const groupGatherTimerRef = useRef<number | null>(null);
  const [collapsedPo, setCollapsedPo] = useState<Record<string, boolean>>({});
  const advancingRef = useRef(false);
  const [, bump] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyPoNumber, setCopyPoNumber] = useState("");
  const [copyTargetKey, setCopyTargetKey] = useState<string | null>(null);

  const refreshWork = useCallback(() => {
    bump((n) => n + 1);
    refreshPartySubmissions();
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
    refreshPartySubmissions,
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
        refreshPartySubmissions();
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
    refreshPartySubmissions,
  ]);

  useEffect(() => {
    if (selectedId) setPanelOpen(true);
    else setPanelOpen(false);
  }, [selectedId]);

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
    (task: WorkflowTask): string | undefined =>
      resolveQueueTaskFullPagePath(config, task),
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
        setCopyPoNumber(task.poNumber.trim());
        setCopyTargetKey(copyPriorTargetKey(propertyId, task.id));
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

  const toggleGroupByPo = useCallback(() => {
    setGroupByPo((prev) => {
      const next = !prev;
      if (next) {
        setCollapsedPo(collapseAllPoGroups(allTransactionsRowMeta));
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
    if (queueSelectionIsStale({ selectedId, tasks: tasks ?? [], listed })) {
      closePanel();
    }
  }, [selectedId, selectedTask, queuePending, listed, closePanel, tasks]);

  useEffect(() => {
    if (!selectedTask) return;
    markTaskRowSeen(selectedTask);
  }, [selectedTask, markTaskRowSeen]);

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

  return {
    router,
    panelOpen,
    refreshWork,
    closePanel,
    useFullPage,
    isTaskOpening,
    handleRowClick,
    resolveRowAttention,
    resolveRowMoreItems,
    handleDistributionRowClick,
    openPropertyDetailFromQueue,
    groupByPo,
    groupGatherAnim,
    toggleGroupByPo,
    collapsedPo,
    setCollapsedPo,
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
