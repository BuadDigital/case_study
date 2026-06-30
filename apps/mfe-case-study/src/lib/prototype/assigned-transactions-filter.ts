import { ROLES } from "@platform/app-shared/prototype/constants";
import { isPartyWorkflowRole } from "@platform/app-shared/prototype/party-task-pages";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import type { PoIntakeRecord } from "./po-intake-data";
import type { WorkflowTask } from "./tasks-storage";

/** POs where أخصائي الإسناد matches the signed-in user (case-study property tasks only). */
export function filterTasksAssignedToSpecialist(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  specialistName: string,
): WorkflowTask[] {
  const name = specialistName.trim();
  if (!name) return tasks;

  return tasks.filter((task) => {
    if (task.kind !== "case-study-property") return false;
    const assigned = poByNumber.get(task.poNumber.trim())?.assignmentSpecialist?.trim();
    return assigned === name;
  });
}

export function filterOpenAssignedTransactions(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  role: RoleId,
  viewerDisplayName: string | null,
): WorkflowTask[] {
  if (isSuperAdmin(role)) return tasks;
  if (isPartyWorkflowRole(role)) return tasks;

  const specialistName =
    viewerDisplayName?.trim() || ROLES[role]?.name?.trim() || "";
  return filterTasksAssignedToSpecialist(tasks, poByNumber, specialistName);
}
