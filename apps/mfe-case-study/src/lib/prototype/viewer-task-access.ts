import type { PageId, RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import { isCaseStudySpecialist } from "./po-roles";
import {
  compareWorkflowTasks,
  tasksForPartyAssignee,
  tasksForRole,
  type WorkflowTask,
} from "./tasks-storage";

/** Case-study workflow queues where the section supervisor oversees all rows. */
const CASE_STUDY_WORKFLOW_QUEUE_PAGES: ReadonlySet<PageId> = new Set([
  "active-primary-data",
  "bourse-inquiry",
  "active-distribution",
  "active-case-study",
]);

export function isCaseStudyWorkflowOverseer(role: RoleId): boolean {
  return role === "section-supervisor";
}

export function seesAllCaseStudyWorkflowTasks(
  role: RoleId,
  pageId?: PageId,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (!isCaseStudyWorkflowOverseer(role)) return false;
  if (!pageId) return true;
  return CASE_STUDY_WORKFLOW_QUEUE_PAGES.has(pageId);
}

export function resolveQueueTasksForViewer(input: {
  role: RoleId;
  tasks: WorkflowTask[];
  pageId?: PageId;
  partyAssignee?: boolean;
  assigneeRole?: RoleId;
  viewerEmail?: string | null;
  viewerAssigneeId?: string | null;
  staffUsers?: StaffUser[];
}): WorkflowTask[] {
  const all = input.tasks;

  if (input.pageId && seesAllCaseStudyWorkflowTasks(input.role, input.pageId)) {
    return [...all].sort(compareWorkflowTasks);
  }

  if (input.partyAssignee) {
    return tasksForPartyAssignee(
      input.role,
      all,
      input.assigneeRole,
      input.viewerEmail,
      input.staffUsers,
      input.viewerAssigneeId,
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
  if (seesAllCaseStudyWorkflowTasks(input.role, input.pageId)) {
    return input.matchesPage(input.task);
  }
  return tasksForRole(input.role, input.tasks).some((t) => t.id === input.task.id);
}

/** Full-page `/case-study/[taskId]` — parent property task, any workflow phase. */
export function canOpenCaseStudyWorkspace(
  role: RoleId,
  task: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  if (task.kind !== "case-study-property") return false;
  if (isSuperAdmin(role)) return true;
  if (seesAllCaseStudyWorkflowTasks(role, "active-case-study")) return true;
  if (
    isCaseStudySpecialist(role) &&
    tasksForRole(role, tasks).some((t) => t.id === task.id)
  ) {
    return true;
  }
  return role === "general-manager" || role === "cdo";
}
