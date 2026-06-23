import type { PageId, RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  compareWorkflowTasks,
  tasksForPartyAssignee,
  tasksForRole,
  type WorkflowTask,
} from "./tasks-storage";

export function resolveQueueTasksForViewer(input: {
  role: RoleId;
  tasks: WorkflowTask[];
  pageId?: PageId;
  partyAssignee?: boolean;
  assigneeRole?: RoleId;
  viewerEmail?: string | null;
  staffUsers?: StaffUser[];
}): WorkflowTask[] {
  const all = input.tasks;

  if (input.pageId && isSuperAdmin(input.role)) {
    return [...all].sort(compareWorkflowTasks);
  }

  if (input.partyAssignee) {
    return tasksForPartyAssignee(
      input.role,
      all,
      input.assigneeRole,
      input.viewerEmail,
      input.staffUsers,
    );
  }

  return tasksForRole(input.role, all);
}

export function canViewWorkflowTask(input: {
  role: RoleId;
  task: WorkflowTask;
  tasks: WorkflowTask[];
  pageId: PageId;
  matchesPage: (task: WorkflowTask) => boolean;
}): boolean {
  if (isSuperAdmin(input.role)) {
    return input.matchesPage(input.task);
  }
  return tasksForRole(input.role, input.tasks).some((t) => t.id === input.task.id);
}
