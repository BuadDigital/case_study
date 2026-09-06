"use client";

/**
 * Operations-tasks action modals — close / pause / priority / reassign — wired
 * to the workflow bag. Both the list page and the detail panel mount this once;
 * `task` is the row the close and priority modals act on and `reassignTarget`
 * the row whose assignee the reassign modal shows.
 */

import dynamic from "next/dynamic";
import { AppModal } from "@platform/ui-kit";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import {
  allowsCompleteOutcome,
  closeModalTitles,
} from "./operations-tasks-view-state";
import { CloseTaskModalBody } from "./OperationsTasksCloseModal";
import {
  PauseModalBody,
  PriorityModalBody,
} from "./OperationsTasksPauseAndPriorityModals";
import type { OperationsTasksWorkflow } from "./OperationsTasksViewShared";

const ReassignOperationsTaskModal = dynamic(
  () =>
    import("../components/tasks/ReassignOperationsTaskModal").then(
      (m) => m.ReassignOperationsTaskModal,
    ),
  { ssr: false },
);

export type OperationsTasksModalsProps = Pick<
  OperationsTasksWorkflow,
  | "applyPrioDueFromOffset"
  | "applyPriority"
  | "busy"
  | "canCreate"
  | "cancelReason"
  | "closeFileInputRef"
  | "closeFiles"
  | "closeFormError"
  | "closeOpen"
  | "closeOutcome"
  | "closeText"
  | "confirmCloseTask"
  | "confirmPauseTask"
  | "courtContacts"
  | "courtKind"
  | "courtOtherText"
  | "courtPerDeed"
  | "courtStatement"
  | "creditAssigneeId"
  | "creditAssignees"
  | "pauseError"
  | "pauseOpen"
  | "pauseReason"
  | "prioDueDate"
  | "prioDueTime"
  | "prioEditDue"
  | "prioOpen"
  | "prioValue"
  | "reassignAssigneeId"
  | "reassignAssignees"
  | "reassignDueDate"
  | "reassignDueTime"
  | "reassignError"
  | "reassignOpen"
  | "reassignReason"
  | "reassigning"
  | "setCancelReason"
  | "setCloseFiles"
  | "setCloseOpen"
  | "setCloseOutcome"
  | "setCloseText"
  | "setCourtContacts"
  | "setCourtKind"
  | "setCourtOtherText"
  | "setCourtPerDeed"
  | "setCourtStatement"
  | "setCreditAssigneeId"
  | "setCreditAssigneeName"
  | "setPauseOpen"
  | "setPauseReason"
  | "setPrioDueDate"
  | "setPrioDueTime"
  | "setPrioEditDue"
  | "setPrioOpen"
  | "setPrioValue"
  | "setReassignAssigneeId"
  | "setReassignAssigneeName"
  | "setReassignDueDate"
  | "setReassignDueTime"
  | "setReassignOpen"
  | "setReassignReason"
  | "showCreditPicker"
  | "submitReassign"
> & {
  task: OperationsTask | undefined;
  reassignTarget: OperationsTask | null | undefined;
};

export function OperationsTasksModals(props: OperationsTasksModalsProps) {
  const { task, reassignTarget, busy, canCreate } = props;
  const closeTitles = closeModalTitles(props.closeOutcome);
  return (
    <>
      <AppModal
        open={props.closeOpen}
        title={closeTitles.title}
        subtitle={closeTitles.subtitle}
        maxWidthPx={540}
        onClose={() => props.setCloseOpen(false)}
      >
        <CloseTaskModalBody
          taskType={task?.type}
          letterRows={task?.letterRows}
          closeOutcome={props.closeOutcome}
          setCloseOutcome={props.setCloseOutcome}
          canCancel={canCreate}
          allowCompleteOutcome={allowsCompleteOutcome(task?.status)}
          cancelReason={props.cancelReason}
          setCancelReason={props.setCancelReason}
          closeText={props.closeText}
          setCloseText={props.setCloseText}
          closeFiles={props.closeFiles}
          setCloseFiles={props.setCloseFiles}
          fileInputRef={props.closeFileInputRef}
          courtKind={props.courtKind}
          setCourtKind={props.setCourtKind}
          courtOtherText={props.courtOtherText}
          setCourtOtherText={props.setCourtOtherText}
          courtStatement={props.courtStatement}
          setCourtStatement={props.setCourtStatement}
          courtPerDeed={props.courtPerDeed}
          setCourtPerDeed={props.setCourtPerDeed}
          courtContacts={props.courtContacts}
          setCourtContacts={props.setCourtContacts}
          showCreditPicker={props.showCreditPicker}
          creditAssignees={props.creditAssignees}
          creditAssigneeId={props.creditAssigneeId}
          setCreditAssigneeId={props.setCreditAssigneeId}
          setCreditAssigneeName={props.setCreditAssigneeName}
          formError={props.closeFormError}
          busy={busy}
          onCancel={() => props.setCloseOpen(false)}
          onConfirm={() => {
            if (!task) return;
            props.confirmCloseTask(task);
          }}
        />
      </AppModal>

      <AppModal
        open={props.pauseOpen}
        title="إيقاف مؤقت"
        subtitle="دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد"
        maxWidthPx={460}
        onClose={() => props.setPauseOpen(false)}
      >
        <PauseModalBody
          pauseReason={props.pauseReason}
          setPauseReason={props.setPauseReason}
          pauseError={props.pauseError}
          busy={busy}
          onCancel={() => props.setPauseOpen(false)}
          onConfirm={() => void props.confirmPauseTask()}
        />
      </AppModal>

      <AppModal
        open={props.prioOpen}
        title="تغيير الأولوية"
        onClose={() => props.setPrioOpen(false)}
      >
        {task ? (
          <PriorityModalBody
            task={task}
            prioValue={props.prioValue}
            setPrioValue={props.setPrioValue}
            prioEditDue={props.prioEditDue}
            setPrioEditDue={props.setPrioEditDue}
            prioDueDate={props.prioDueDate}
            setPrioDueDate={props.setPrioDueDate}
            prioDueTime={props.prioDueTime}
            setPrioDueTime={props.setPrioDueTime}
            onFitPriorityDue={props.applyPrioDueFromOffset}
            busy={busy}
            onCancel={() => props.setPrioOpen(false)}
            onApply={() => void props.applyPriority(task.id)}
          />
        ) : null}
      </AppModal>

      {props.reassignOpen ? (
        <ReassignOperationsTaskModal
          open={props.reassignOpen}
          currentAssigneeName={reassignTarget?.assigneeName ?? ""}
          currentAssigneeRole={
            reassignTarget
              ? props.reassignAssignees.find((a) => a.id === reassignTarget.assigneeId)
                  ?.subtitle
              : undefined
          }
          assignees={props.reassignAssignees}
          assigneeId={props.reassignAssigneeId}
          dueDate={props.reassignDueDate}
          dueTime={props.reassignDueTime}
          reason={props.reassignReason}
          error={props.reassignError}
          busy={busy || props.reassigning}
          onAssigneeChange={(id, name) => {
            props.setReassignAssigneeId(id);
            props.setReassignAssigneeName(name);
          }}
          onDueDateChange={props.setReassignDueDate}
          onDueTimeChange={props.setReassignDueTime}
          onReasonChange={props.setReassignReason}
          onClose={() => props.setReassignOpen(false)}
          onSubmit={props.submitReassign}
        />
      ) : null}
    </>
  );
}
