"use client";

/**
 * Operations-tasks screen — composition only. Workflow lives in
 * `useOperationsTasksWorkflow`; each region (`OperationsTasksKpiBand`,
 * `OperationsTasksFiltersBar`, `OperationsTasksTable`,
 * `OperationsTasksMobileCards`, `OperationsTasksDetailPanel`,
 * `OperationsTasksModals`) renders one slice of the returned bag.
 */

import dynamic from "next/dynamic";
import { Note, OperationalPanel, PageShell, PanelSkeleton } from "@platform/ui-kit";
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

// Modal is ~934 lines and only shown on demand — do not mount it in the screen chunk (bundle-dynamic-imports).
const CreateOperationsTaskModal = dynamic(
  () =>
    import("../components/CreateOperationsTaskModal").then(
      (m) => m.CreateOperationsTaskModal,
    ),
  { ssr: false },
);
// Prefetch on hover of the create button — hides chunk fetch latency (bundle-preload).
const preloadCreateOperationsTaskModal = () =>
  void import("../components/CreateOperationsTaskModal");

export function OperationsTasksView() {
  const workflow = useOperationsTasksWorkflow();
  const {
    createOpen,
    createPrefill,
    detail,
    error,
    isFetched,
    isFetching,
    kpis,
    poRecords,
    reassignTask,
    refetch,
    selectedId,
    setCreateOpen,
    setCreatePrefill,
    setDetailId,
    setSelectedId,
    staffLoadError,
    staffLoading,
    staffUsers,
    tasks,
  } = workflow;

  if (!isFetched && isFetching) {
    return <PanelSkeleton className="p-4" />;
  }

  if (detail) {
    return (
      <OperationsTasksDetailPanel {...workflow} detail={detail}>
        <OperationsTasksModals {...workflow} task={detail} reassignTarget={detail} />
      </OperationsTasksDetailPanel>
    );
  }

  const selectedTask = tasks.find((t) => t.id === selectedId);

  return (
    <PageShell variant="canvas" className="gap-3.5 p-4 sm:gap-3.5 sm:p-6">
      <OperationsTasksKpiBand kpis={kpis} />

      <OperationsTasksFiltersBar
        {...workflow}
        onPreloadCreate={preloadCreateOperationsTaskModal}
      />

      <OperationsTasksBulkBar {...workflow} />

      {error ? <Note tone="danger">{error}</Note> : null}

      <OperationalPanel className="min-h-0 flex-1 overflow-hidden !rounded-[12px] p-0 max-lg:border-0 max-lg:bg-transparent max-lg:!rounded-none max-lg:shadow-none">
        <OperationsTasksTable {...workflow} />
        <OperationsTasksMobileCards {...workflow} />
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
  );
}
