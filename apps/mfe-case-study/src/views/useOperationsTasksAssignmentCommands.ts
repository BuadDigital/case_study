"use client";

/**
 * The two "who and when" modals of `useOperationsTasksWorkflow`: change
 * priority (with an optional due-date edit) and reassign. Split from
 * `useOperationsTasksCommands` so each write hook stays readable; both share
 * that hook's `runPatch` / toast and the selection owned by
 * `useOperationsTasksData`.
 */
import { useCallback, useState, useTransition } from "react";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import { reassignOperationsTaskRecord } from "../lib/app-data/operations-tasks-commands";
import {
  toLocalDateValue,
  toLocalTimeValue,
  PRIORITY_OFFSET_MS,
} from "./OperationsTasksViewShared";
import {
  dueDateFromLocalParts,
  localDueParts,
  type OperationsTaskPatch,
} from "./operations-tasks-view-state";
import type { OperationsTasksData } from "./useOperationsTasksData";
import type { OperationsTasksCommands } from "./useOperationsTasksCommands";

export function useOperationsTasksAssignmentCommands({
  data,
  commands,
}: {
  data: OperationsTasksData;
  commands: Pick<OperationsTasksCommands, "runPatch" | "showToast">;
}) {
  const { selectedId, setSelectedId, detailId, setDetailId, refetch } = data;
  const { runPatch, showToast } = commands;
  const [reassigning, startReassign] = useTransition();
  const [prioOpen, setPrioOpen] = useState(false);
  const [prioValue, setPrioValue] = useState("medium");
  const [prioEditDue, setPrioEditDue] = useState(false);
  const [prioDueDate, setPrioDueDate] = useState("");
  const [prioDueTime, setPrioDueTime] = useState("12:00");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignAssigneeId, setReassignAssigneeId] = useState("");
  const [reassignAssigneeName, setReassignAssigneeName] = useState("");
  const [reassignDueDate, setReassignDueDate] = useState("");
  const [reassignDueTime, setReassignDueTime] = useState("12:00");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);

  const openPriorityModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setPrioValue(task.priority);
    setPrioEditDue(false);
    const due = localDueParts(task.dueAt);
    setPrioDueDate(due.date);
    setPrioDueTime(due.time);
    setPrioOpen(true);
  }, [setSelectedId, setDetailId]);

  const applyPrioDueFromOffset = useCallback(() => {
    const ms = PRIORITY_OFFSET_MS[prioValue] ?? PRIORITY_OFFSET_MS.medium;
    const due = new Date(Date.now() + ms!);
    setPrioDueDate(toLocalDateValue(due));
    setPrioDueTime(toLocalTimeValue(due));
  }, [prioValue]);

  const applyPriority = useCallback(
    async (id: string) => {
      const body: OperationsTaskPatch = {
        priority: prioValue,
      };
      if (prioEditDue && prioDueDate.trim()) {
        body.dueAtUtc = dueDateFromLocalParts(
          prioDueDate,
          prioDueTime,
        ).toISOString();
      }
      const ok = await runPatch(id, body);
      if (ok) {
        setPrioOpen(false);
        setPrioEditDue(false);
        showToast("تم تحديث المهمة", "success");
      }
    },
    [prioValue, prioEditDue, prioDueDate, prioDueTime, runPatch, showToast],
  );

  const openReassign = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setReassignAssigneeId(task.assigneeId || "");
    setReassignAssigneeName(task.assigneeName || "");
    const due = localDueParts(task.dueAt);
    setReassignDueDate(due.date);
    setReassignDueTime(due.time);
    setReassignReason("");
    setReassignError(null);
    setReassignOpen(true);
  }, [setSelectedId, setDetailId]);

  const submitReassign = useCallback(() => {
    const taskId = selectedId ?? detailId;
    if (!taskId) return;
    if (!reassignAssigneeId.trim()) {
      setReassignError("اختر المنفّذ.");
      return;
    }
    if (!reassignReason.trim()) {
      setReassignError("سبب إعادة التوجيه مطلوب.");
      return;
    }
    if (!reassignDueDate.trim()) {
      setReassignError("حدد موعد الاستحقاق.");
      return;
    }
    const due = dueDateFromLocalParts(reassignDueDate, reassignDueTime);
    setReassignError(null);
    // Reassign modal is the visible UI while sending — dedicated transition.
    startReassign(async () => {
      const res = await reassignOperationsTaskRecord(taskId, {
        assigneeId: reassignAssigneeId.trim(),
        assigneeName: reassignAssigneeName.trim() || undefined,
        dueAtUtc: due.toISOString(),
        reason: reassignReason.trim(),
      });
      if (!res.ok) {
        setReassignError(res.error);
        return;
      }
      setReassignOpen(false);
      setReassignReason("");
      showToast("تم إعادة التوجيه والإسناد", "success");
      await refetch();
    });
  }, [
    selectedId,
    detailId,
    reassignAssigneeId,
    reassignAssigneeName,
    reassignDueDate,
    reassignDueTime,
    reassignReason,
    showToast,
    refetch,
  ]);

  return {
    reassigning,
    prioOpen,
    setPrioOpen,
    prioValue,
    setPrioValue,
    prioEditDue,
    setPrioEditDue,
    prioDueDate,
    setPrioDueDate,
    prioDueTime,
    setPrioDueTime,
    reassignOpen,
    setReassignOpen,
    reassignAssigneeId,
    setReassignAssigneeId,
    reassignAssigneeName,
    setReassignAssigneeName,
    reassignDueDate,
    setReassignDueDate,
    reassignDueTime,
    setReassignDueTime,
    reassignReason,
    setReassignReason,
    reassignError,
    openPriorityModal,
    applyPrioDueFromOffset,
    applyPriority,
    openReassign,
    submitReassign,
  };
}
