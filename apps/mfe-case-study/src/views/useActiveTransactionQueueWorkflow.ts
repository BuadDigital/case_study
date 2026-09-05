"use client";

/**
 * All non-rendering behaviour of `ActiveTransactionQueueView`, composed from
 * two halves: reads in `useActiveTransactionQueueData` (queries, viewer
 * scoping, filters, row meta, paging), writes in
 * `useActiveTransactionQueueCommands` (open / refresh / copy, row menu, queue
 * api). This file only wires them and builds the row context and the mobile
 * cards; the view consumes the returned bag and keeps JSX only.
 */
import type { MutableRefObject } from "react";
import { useMemo } from "react";
import type { QueueRowContext } from "./active-transaction-queue-tables-state";
import {
  buildAllTxPoGroups,
  type ActiveQueueApi,
  type ActiveTransactionQueueConfig,
} from "./active-transaction-queue-state";
import { buildQueueMobileCardItems } from "./active-transaction-queue-cards";
import {
  EMPTY_TASKS,
  useActiveTransactionQueueData,
} from "./useActiveTransactionQueueData";
import { useActiveTransactionQueueCommands } from "./useActiveTransactionQueueCommands";

export { EMPTY_TASKS };

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
  const data = useActiveTransactionQueueData({ config });
  const {
    selectedId,
    tasks,
    staffUsers,
    now,
    isDesktopViewport,
    flags,
    paged,
    pagination,
    page,
    setPage,
    isPagePlaceholder,
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
    filteredListed,
    filteredPrimaryMeta,
    filteredAllTxMeta,
    partyProgressByTask,
    primaryHasLocation,
    assignmentTypes,
    statusOptions,
  } = data;
  const {
    isPropertyInspectionQueue,
    isDistributionTable,
    isAllTransactionsTable,
    isEngineeringSurveyTable,
    isPropertyAppraisalTable,
    isPartyQueueToggleTable,
    showPartyColumns,
  } = flags;
  const {
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
  } = useActiveTransactionQueueCommands({ config, queueApiRef, data });

  // Rows in these two branches open the transaction work screen that starts with the Infath form.
  const preloadRowWork =
    isAllTransactionsTable ||
    (!isDistributionTable && !isPartyQueueToggleTable)
      ? preloadPoPropertyEnfathForm
      : undefined;

  const allTxPoGroups = useMemo(() => {
    if (!isAllTransactionsTable || !groupByPo) return [];
    return buildAllTxPoGroups(filteredAllTxMeta);
  }, [isAllTransactionsTable, groupByPo, filteredAllTxMeta]);

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
    paged,
    pagination,
    page,
    setPage,
    isPagePlaceholder,
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
