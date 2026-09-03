import type { RoleId } from "@platform/types";
import { listWorkflowTasks } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { apiErrorMessage, workOrdersApiConfig } from "../work-orders-api-config";
import { isBrowserOffline } from "@platform/app-shared/offline/offline-write";
import { readPrefetchedWorkflowTasks } from "@platform/app-shared/offline/prefetch-read";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  getRoleAssigneeId,
  partyAccountForViewer,
} from "./distribution-parties";
import { ROLES, type StaffUser } from "@platform/app-shared/app-data/constants";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import {
  dtoToTask,
  migrateDistribution,
  partyAssigneeIdFromDistribution,
} from "./tasks-model";

export async function loadWorkflowTasks(): Promise<WorkflowTask[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listWorkflowTasks(config);
  if (!result.ok) return [];
  return result.data.map(dtoToTask);
}

/** React Query loader — surfaces API failures; fetches workflow tasks in paginated chunks. */
export async function loadWorkflowTasksForQuery(): Promise<WorkflowTask[]> {
  const config = workOrdersApiConfig();
  if (!config || isBrowserOffline()) {
    const cached = await readPrefetchedWorkflowTasks<WorkflowTask>();
    if (cached?.length) return cached;
    if (!config) throw new Error(apiErrorMessage("auth"));
    throw new Error("تعذّر تحميل مهام سير العمل");
  }
  try {
    const result = await listWorkflowTasks(config);
    if (!result.ok) {
      const cached = await readPrefetchedWorkflowTasks<WorkflowTask>();
      if (cached?.length) return cached;
      throw new Error(
        apiErrorMessage(result.kind, "تعذّر تحميل مهام سير العمل"),
      );
    }
    return result.data.map(dtoToTask);
  } catch (err) {
    const cached = await readPrefetchedWorkflowTasks<WorkflowTask>();
    if (cached?.length) return cached;
    if (err instanceof Error) throw err;
    throw new Error("تعذّر تحميل مهام سير العمل");
  }
}

/** Case-study slots that belong to one PO. */
export function poCaseTasks(list: WorkflowTask[], poNumber: string): WorkflowTask[] {
  const n = poNumber.trim();
  return list.filter(
    (t) => t.kind === "case-study-property" && t.poNumber.trim() === n,
  );
}

export function caseStudyTaskForProperty(
  poNumber: string,
  propertyId: string,
  list: WorkflowTask[],
): WorkflowTask | undefined {
  return list.find(
    (t) =>
      t.kind === "case-study-property" &&
      t.poNumber.trim() === poNumber.trim() &&
      t.propertyId === propertyId,
  );
}

export function compareWorkflowTasks(
  a: WorkflowTask,
  b: WorkflowTask,
): number {
  const dateA = (a.updatedAt || a.createdAt || "").trim();
  const dateB = (b.updatedAt || b.createdAt || "").trim();
  const dateCmp = dateB.localeCompare(dateA);
  if (dateCmp !== 0) return dateCmp;
  const poCmp = a.poNumber.localeCompare(b.poNumber, undefined, {
    numeric: true,
  });
  if (poCmp !== 0) return poCmp;
  return a.propertyOrdinal - b.propertyOrdinal;
}

export function tasksForRole(
  role: RoleId,
  tasks: WorkflowTask[],
): WorkflowTask[] {
  if (isSuperAdmin(role)) return [...tasks].sort(compareWorkflowTasks);
  return tasks
    .filter((t) => t.assigneeRole === role)
    .sort(compareWorkflowTasks);
}

function taskMatchesPartyAssignee(
  task: WorkflowTask,
  expectedId: string | undefined,
  expectedName: string | undefined,
  allTasks: WorkflowTask[],
): boolean {
  const id = expectedId?.trim();
  const name = expectedName?.trim();

  if (id && task.assigneeId?.trim() === id) return true;
  if (name && task.assigneeName.trim() === name) return true;

  if (id && task.parentTaskId) {
    const parent = allTasks.find((p) => p.id === task.parentTaskId);
    const distribution = parent?.distribution
      ? migrateDistribution(parent.distribution)
      : undefined;
    if (distribution) {
      const fromDistribution = partyAssigneeIdFromDistribution(
        task.kind,
        distribution,
      );
      if (fromDistribution && fromDistribution === id) return true;
    }
  }

  if (!id && !name) return true;
  return false;
}

export function tasksForPartyAssignee(
  viewerRole: RoleId,
  tasks: WorkflowTask[],
  queueRole?: RoleId,
  viewerEmail?: string | null,
  staffUsers: StaffUser[] = [],
  viewerAssigneeId?: string | null,
): WorkflowTask[] {
  if (isSuperAdmin(viewerRole) && !queueRole) {
    return [...tasks].sort(compareWorkflowTasks);
  }
  const role =
    isSuperAdmin(viewerRole) && queueRole ? queueRole : viewerRole;
  const session = typeof window !== "undefined" ? getAuthSession() : null;
  const email = viewerEmail?.trim() || session?.user.email?.trim() || null;
  const account = partyAccountForViewer(role, email, staffUsers);
  const expectedId =
    account?.assigneeId?.trim() ||
    viewerAssigneeId?.trim() ||
    (email ? "" : getRoleAssigneeId(staffUsers)[role]?.trim()) ||
    undefined;
  const expectedName =
    account?.name?.trim() ||
    session?.user.displayName?.trim() ||
    ROLES[role]?.name;
  return tasks
    .filter((t) => t.assigneeRole === role)
    .filter((t) =>
      taskMatchesPartyAssignee(t, expectedId, expectedName, tasks),
    )
    .sort(compareWorkflowTasks);
}
