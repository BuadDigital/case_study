import type { CustomAssignedScreen, PageId, RoleId } from "@platform/types";
import { viewerSeesFullPageData } from "@platform/app-shared/prototype/custom-assigned-page-access";
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
  customAssignedScreens: readonly CustomAssignedScreen[];
  partyAssignee?: boolean;
  assigneeRole?: RoleId;
  viewerEmail?: string | null;
}): WorkflowTask[] {
  const all = input.tasks;

  if (
    input.pageId &&
    viewerSeesFullPageData(input.pageId, input.role, input.customAssignedScreens)
  ) {
    return [...all].sort(compareWorkflowTasks);
  }

  if (input.partyAssignee) {
    return tasksForPartyAssignee(
      input.role,
      all,
      input.assigneeRole,
      input.viewerEmail,
    );
  }

  return tasksForRole(input.role, all);
}

export function canViewWorkflowTask(input: {
  role: RoleId;
  task: WorkflowTask;
  tasks: WorkflowTask[];
  pageId: PageId;
  customAssignedScreens: readonly CustomAssignedScreen[];
  matchesPage: (task: WorkflowTask) => boolean;
}): boolean {
  if (viewerSeesFullPageData(input.pageId, input.role, input.customAssignedScreens)) {
    return input.matchesPage(input.task);
  }
  return tasksForRole(input.role, input.tasks).some((t) => t.id === input.task.id);
}
