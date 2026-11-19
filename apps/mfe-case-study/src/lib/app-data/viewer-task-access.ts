import type { PageId, RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import { isCaseStudySpecialist } from "./po-roles";
import {
  compareWorkflowTasks,
  tasksForPartyAssignee,
  tasksForRole,
  type WorkflowTask,
} from "./tasks";
import { WorkflowTaskKinds } from "@platform/app-shared/workflow/task-types";
import { Roles, Pages } from "@platform/types";

/** Case-study workflow queues where the section supervisor oversees all rows. */
const CASE_STUDY_WORKFLOW_QUEUE_PAGES: ReadonlySet<PageId> = new Set([
  Pages.ActivePrimaryData,
  Pages.BourseInquiry,
  Pages.ActiveDistribution,
  Pages.ActiveReceipt,
  Pages.ActiveCaseStudy,
  Pages.SystemUpload,
]);

function isCaseStudyWorkflowOverseer(role: RoleId): boolean {
  return role === Roles.SectionSupervisor;
}

export function seesAllCaseStudyWorkflowTasks(
  role: RoleId,
  pageId?: PageId,
): boolean {
  if (isSuperAdmin(role)) return true;
  // All-transactions lists one row per property at its latest stage, which
  // needs sibling party tasks — not only the specialist's own assigneeRole.
  if (isCaseStudySpecialist(role) && pageId === Pages.AllTransactions) return true;
  // The appraiser reads every transaction there too, read only (Omar 2026-11-17).
  if (role === Roles.RealEstateAppraiser && pageId === Pages.AllTransactions) return true;
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
  viewerUserId?: string | null;
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
      input.viewerUserId,
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
  if (task.kind !== WorkflowTaskKinds.CaseStudyProperty) return false;
  if (isSuperAdmin(role)) return true;
  if (seesAllCaseStudyWorkflowTasks(role, Pages.ActiveCaseStudy)) return true;
  if (
    isCaseStudySpecialist(role) &&
    tasksForRole(role, tasks).some((t) => t.id === task.id)
  ) {
    return true;
  }
  return role === Roles.GeneralManager || role === Roles.Cdo;
}
