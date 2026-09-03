"use client";

import type { MutableRefObject, ReactNode } from "react";
import { useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Button,
  cn,
  EmptyState,
  Note,
  OperationalPanel,
  PageShellHeader,
  queueLegacyStatusStyle,
  QueueTableHint,
  StatusPill,
  TableFrame,
} from "@platform/ui-kit";
import {
  RemainingTimeCell,
  TickingRemainingTimeCell,
} from "@case-study/mfe/components/ui/RemainingTimeCell";
const CopyFromPriorTransactionModal = dynamic(
  () =>
    import("../components/po-intake/CopyFromPriorTransactionModal").then(
      (m) => m.CopyFromPriorTransactionModal,
    ),
  { ssr: false },
);
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { ActiveQueueMobileCards } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { InspectorMobileQueue } from "../components/field-inspection/InspectorMobileQueue";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import {
  AllTransactionsQueueTable,
  DistributionQueueTable,
  EngineeringSurveyQueueTable,
  PrimaryQueueTable,
  PropertyAppraisalQueueTable,
  QueueFiltersToolbar,
} from "./active-transaction-queue-tables";
import type {
  ActiveQueueApi,
  ActiveTransactionQueueConfig,
} from "./active-transaction-queue-state";
import {
  EMPTY_TASKS,
  useActiveTransactionQueueWorkflow,
} from "./useActiveTransactionQueueWorkflow";

export type {
  ActiveQueueApi,
  ActiveQueueRowMoreContext,
  ActiveTransactionQueueConfig,
  ActiveTransactionQueueTableLayout,
} from "./active-transaction-queue-state";

type PanelRenderProps = {
  task: WorkflowTask;
  onRefresh: () => void;
  onClose: () => void;
};

export function ActiveTransactionQueueView({
  config,
  renderPanel,
  queueApiRef,
}: {
  config: ActiveTransactionQueueConfig;
  renderPanel?: (props: PanelRenderProps) => ReactNode;
  queueApiRef?: MutableRefObject<ActiveQueueApi | null>;
}) {
  const {
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
  } = useActiveTransactionQueueWorkflow({ config, queueApiRef });

  const renderStatusOrRemaining = useCallback(
    (
      task: WorkflowTask,
      remainingTime: Parameters<typeof RemainingTimeCell>[0]["state"],
    ) => {
      const badge = resolveTaskBadge(task);
      if (badge) {
        return (
          <StatusPill
            label={badge.label}
            style={queueLegacyStatusStyle(badge.className)}
          />
        );
      }
      const dueIso = poByNumber.get(task.poNumber.trim())?.dueDateAt ?? "";
      // Per-second timer updates inside the cell — the row itself rebuilds at minute precision only.
      if (dueIso) return <TickingRemainingTimeCell dueIso={dueIso} />;
      return <RemainingTimeCell state={remainingTime} />;
    },
    [resolveTaskBadge, poByNumber],
  );

  const queueToolbar = queueReady ? (
    <QueueFiltersToolbar
      queueReady={queueReady}
      isPartyQueueToggleTable={isPartyQueueToggleTable}
      isPropertyAppraisalTable={isPropertyAppraisalTable}
      isDistributionTable={isDistributionTable}
      isAllTransactionsTable={isAllTransactionsTable}
      search={search}
      onSearchChange={setSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      statusOptions={statusOptions}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      assignmentTypes={assignmentTypes}
      showCompleted={showCompleted}
      onToggleShowCompleted={() => setShowCompleted((v) => !v)}
      groupByPo={groupByPo}
      groupGatherAnim={groupGatherAnim}
      onToggleGroupByPo={toggleGroupByPo}
      filteredCount={filteredListed.length}
    />
  ) : null;

  const hasRail =
    !useFullPage && queueReady && listed.length > 0 && Boolean(renderPanel);

  const queuePanel = (
        <OperationalPanel
          className={cn(
            "min-h-0",
            hasRail && panelOpen
              ? "lg:h-full lg:overflow-hidden"
              : "flex-none",
            /* Desktop menus may escape; never let X overflow widen the mobile page. */
            isPartyQueueToggleTable && "max-lg:overflow-x-hidden lg:overflow-visible",
            /* Mobile: drop heavy table panel chrome — cards float on canvas. */
            "max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none",
          )}
        >
          {!config.hidePageTitle && config.pageTitle ? (
            <PageShellHeader title={config.pageTitle} />
          ) : null}

          {queueLoadError ? (
            <div className="flex flex-col gap-3 p-4">
              <Note tone="warn">{queueErrorMessage}</Note>
              <Button type="button" variant="outline" size="sm" onClick={retryQueueLoad}>
                إعادة المحاولة
              </Button>
            </div>
          ) : queueReady && listed.length === 0 ? (
            <EmptyState line={config.emptyLine} hint={config.emptyHint} />
          ) : (
            <>
              {queueToolbar}
              {isDesktopViewport === true ? null : isPropertyInspectionQueue ? (
                <div className="pb-3 lg:hidden max-lg:px-0">
                  <InspectorMobileQueue
                    tasks={filteredListed}
                    poByNumber={poByNumber}
                    now={now}
                    pending={queuePending}
                    onOpen={handleRowClick}
                    resolveBadge={resolveTaskBadge}
                    resolveMoreItems={resolveRowMoreItems}
                    isOpening={isTaskOpening}
                  />
                </div>
              ) : (
                <div
                  className="pb-3 lg:hidden max-lg:px-0"
                  onMouseEnter={preloadRowWork}
                  onFocus={preloadRowWork}
                >
                  <ActiveQueueMobileCards
                    items={mobileQueueCardItems}
                    pending={queuePending}
                    emptyMessage={
                      isEngineeringSurveyTable
                        ? "لا توجد أوامر رفع مطابقة."
                        : isAllTransactionsTable
                          ? "لا توجد معاملات مطابقة."
                          : (config.emptyLine ?? "لا توجد معاملات مطابقة.")
                    }
                  />
                </div>
              )}
              {isDesktopViewport === false ? null : (
              <TableFrame
                className={cn(
                  "max-lg:hidden lg:block",
                  hasRail &&
                    panelOpen &&
                    "lg:min-h-0 lg:flex-1 lg:overflow-auto",
                )}
                onMouseEnter={preloadRowWork}
                onFocus={preloadRowWork}
              >
                {isAllTransactionsTable ? (
                  <AllTransactionsQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredAllTxMeta}
                    groupByPo={groupByPo}
                    poGroups={allTxPoGroups}
                    collapsedPo={collapsedPo}
                    onToggleCollapsed={(po) =>
                      setCollapsedPo((prev) => ({ ...prev, [po]: !prev[po] }))
                    }
                    onOpenPoProperties={(po) =>
                      router.push(poPropertiesPath(po))
                    }
                  />
                ) : isDistributionTable ? (
                  <DistributionQueueTable
                    ctx={rowCtx}
                    showPartyColumns={showPartyColumns}
                    disableRowOpen={Boolean(config.disableRowOpen)}
                    filteredListed={filteredListed}
                    poByNumber={poByNumber}
                    tasks={tasks ?? EMPTY_TASKS}
                    partyProgressByTask={partyProgressByTask}
                    staffUsers={staffUsers}
                    onRowClick={handleDistributionRowClick}
                    openPropertyDetail={openPropertyDetailFromQueue}
                  />
                ) : isEngineeringSurveyTable ? (
                  <EngineeringSurveyQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    resolveTaskBadge={resolveTaskBadge}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                ) : isPropertyAppraisalTable ? (
                  <PropertyAppraisalQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    tasks={tasks ?? EMPTY_TASKS}
                    openPropertyDetail={openPropertyDetailFromQueue}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                ) : (
                  <PrimaryQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    primaryHasLocation={primaryHasLocation}
                    renderStatusOrRemaining={renderStatusOrRemaining}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                )}
                <QueueTableHint
                  className={cn(
                    (config.pageId === "all-transactions" ||
                      config.pageId === "active-primary-data" ||
                      isPartyQueueToggleTable) &&
                      "border-t border-border bg-surface-2",
                  )}
                >
                  {config.tableHint ??
                    (config.disableRowOpen
                      ? "افتح عبر رقم الصك أو أمر العمل أو قائمة ⋮."
                      : useFullPage
                        ? "اضغط الصف لفتح دراسة الحالة."
                        : "اضغط الصف للفتح أو الإغلاق.")}
                </QueueTableHint>
              </TableFrame>
              )}
            </>
          )}
        </OperationalPanel>
  );

  const sidePanel =
    hasRail && renderPanel ? (
      <OperationalPanel
        id={config.panelId}
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col !overflow-hidden",
          /* Mobile: fully remove closed rail (invisible still widens the page). */
          panelOpen
            ? "visible opacity-100"
            : "pointer-events-none max-lg:hidden lg:invisible lg:opacity-0",
        )}
      >
        {panelOpen && selectedTask ? (
          <div
            key={selectedTask.id}
            className="ui-queue-panel-in flex min-h-0 min-w-0 flex-1 flex-col"
          >
            {renderPanel({
              task: selectedTask,
              onRefresh: refreshWork,
              onClose: closePanel,
            })}
          </div>
        ) : null}
      </OperationalPanel>
    ) : null;

  return (
    <>
      <ActiveTransactionPageLayout
        pageId={config.pageId ?? "active-primary-data"}
        hasRail={hasRail}
        panelOpen={panelOpen}
        queuePanel={queuePanel}
        sidePanel={sidePanel}
      />
      {config.allowCopyFromPrior && copyPoNumber ? (
        <CopyFromPriorTransactionModal
          open={copyModalOpen}
          poNumber={copyPoNumber}
          targets={copyTargets}
          initialTargetKey={copyTargetKey}
          lockTarget
          onClose={() => {
            setCopyModalOpen(false);
            setCopyTargetKey(null);
            setCopyPoNumber("");
          }}
          onCopied={handleCopiedFromPrior}
        />
      ) : null}
    </>
  );
}
