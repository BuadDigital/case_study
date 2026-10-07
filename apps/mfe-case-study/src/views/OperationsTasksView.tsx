"use client";

/**
 * Operations-tasks screen — composition only. Workflow lives in
 * `useOperationsTasksWorkflow`; each region (`OperationsTasksKpiBand`,
 * `OperationsTasksFiltersBar`, `OperationsTasksTable`,
 * `OperationsTasksMobileCards`, `OperationsTasksDetailPanel`,
 * `OperationsTasksModals`) renders one slice of the returned bag.
 */

import { useRef } from "react";
import {
  Note,
  OperationalPanel,
  PageShell,
  PanelSkeleton,
  useSwapAnimation,
} from "@platform/ui-kit";
import {
  TASKS_LIST_FOOTER,
  TasksSectionNote,
} from "../components/tasks/TasksHtmlPrimitives";
import { useOperationsTasksWorkflow } from "./useOperationsTasksWorkflow";
import { OperationsTasksKpiBand } from "./OperationsTasksKpiBand";
import {
  OperationsTasksBulkBar,
  OperationsTasksFiltersBar,
} from "./OperationsTasksFiltersBar";
import { OperationsTasksTable } from "./OperationsTasksTable";
import { OperationsTasksMobileCards } from "./OperationsTasksMobileCards";
import { OperationsTasksDetailPanel } from "./OperationsTasksDetailPanel";
import { OperationsTasksModals } from "./OperationsTasksModals";
import {
  CreateOperationsTaskModal,
  preloadCreateOperationsTaskModal,
  usePreloadOperationsTaskModals,
} from "./OperationsTasksLazyModals";

export function OperationsTasksView() {
  const workflow = useOperationsTasksWorkflow();
  const {
    canCreate,
    createOpen,
    createPrefill,
    detail,
    error,
    isFetching,
    isPending,
    kpis,
    listSwapKey,
    poRecords,
    reassignTask,
    refetch,
    selectedId,
    setCreateOpen,
    setCreatePrefill,
    setDetailId,
    setSelectedId,
    showGovFailureRaise,
    staffLoadError,
    staffLoading,
    staffUsers,
    tasks,
  } = workflow;

  usePreloadOperationsTaskModals({
    reassign: canCreate,
    failureRaise: showGovFailureRaise,
  });
  // List <-> task detail fades in place; a filter change fades the rows only.
  const screenSwapRef = useRef<HTMLDivElement>(null);
  const listSwapRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(screenSwapRef, detail?.id ?? null);
  useSwapAnimation(listSwapRef, listSwapKey);

  // Skeleton only before the first rows: a filter / search change keeps the
  // previous rows (keepPreviousData) instead of blanking the whole screen.
  if (isPending && isFetching) {
    return <PanelSkeleton className="p-4" />;
  }

  if (detail) {
    return (
      <div ref={screenSwapRef} className="min-w-0">
        <OperationsTasksDetailPanel {...workflow} detail={detail}>
          <OperationsTasksModals {...workflow} task={detail} reassignTarget={detail} />
        </OperationsTasksDetailPanel>
      </div>
    );
  }

  const selectedTask = tasks.find((t) => t.id === selectedId);

  return (
    <div ref={screenSwapRef} className="min-w-0">
      <PageShell variant="canvas" className="gap-3.5 p-4 sm:gap-3.5 sm:p-6">
        <OperationsTasksKpiBand kpis={kpis} />

        <OperationsTasksFiltersBar
          {...workflow}
          onPreloadCreate={preloadCreateOperationsTaskModal}
        />

        <OperationsTasksBulkBar {...workflow} />

        {error ? <Note tone="danger">{error}</Note> : null}

        <OperationalPanel className="min-h-0 flex-1 overflow-hidden !rounded-[12px] p-0 max-lg:border-0 max-lg:bg-transparent max-lg:!rounded-none max-lg:shadow-none">
          <div ref={listSwapRef}>
            <OperationsTasksTable {...workflow} />
            <OperationsTasksMobileCards {...workflow} />
          </div>
          <TasksSectionNote>{TASKS_LIST_FOOTER}</TasksSectionNote>
        </OperationalPanel>

        {/* Conditional mount — always-on mounting still fetched the chunk when opening the screen despite splitting. */}
        {createOpen ? (
          <CreateOperationsTaskModal
            open={createOpen}
            poRecords={poRecords}
            staffUsers={staffUsers}
            staffLoadError={staffLoadError}
            staffLoading={staffLoading}
            prefill={createPrefill}
            onClose={() => {
              setCreateOpen(false);
              setCreatePrefill(null);
            }}
            onCreated={(taskId) => {
              setSelectedId(taskId);
              setDetailId(taskId);
              void refetch();
            }}
          />
        ) : null}

        <OperationsTasksModals
          {...workflow}
          task={selectedTask}
          reassignTarget={reassignTask}
        />
      </PageShell>
    </div>
  );
}
