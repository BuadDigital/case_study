/**
 * Client-side mirror of the workflow-task list filters the server applies
 * (`docs/architecture/pagination-contract.md` §2). The API is the source of
 * truth; this exists only so the offline prefetch cache answers a filtered
 * query the same way the endpoint would, and so the filter shape is testable
 * without a network.
 */
import type { WorkflowTaskListFilters } from "@platform/api-client";

/** The columns the server filters and searches on. */
export type WorkflowTaskFilterRow = {
  kind: string;
  status: string;
  phase: string;
  poNumber: string;
  title: string;
  assigneeName: string;
  assigneeRole: string;
  assigneeId?: string;
  assignmentType?: string;
};

/** Splits a CSV filter into its tokens; blanks are dropped, as on the server. */
export function csvFilterTokens(
  value: string | readonly string[] | undefined,
): string[] {
  if (value === undefined || value === null) return [];
  const raw = typeof value === "string" ? value.split(",") : [...value];
  return raw.map((token) => token.trim()).filter((token) => token.length > 0);
}

function matchesCsv(
  actual: string,
  filter: string | readonly string[] | undefined,
): boolean {
  const tokens = csvFilterTokens(filter);
  if (tokens.length === 0) return true;
  return tokens.includes(actual.trim());
}

function matchesExact(actual: string | undefined, filter?: string): boolean {
  const wanted = filter?.trim();
  if (!wanted) return true;
  return (actual ?? "").trim() === wanted;
}

export function matchesWorkflowTaskFilters(
  task: WorkflowTaskFilterRow,
  filters?: WorkflowTaskListFilters,
): boolean {
  if (!filters) return true;
  if (!matchesCsv(task.kind, filters.kind)) return false;
  if (!matchesCsv(task.status, filters.status)) return false;
  if (!matchesCsv(task.phase, filters.phase)) return false;
  if (!matchesExact(task.assigneeId, filters.assigneeId)) return false;
  if (!matchesExact(task.poNumber, filters.poNumber)) return false;
  if (!matchesExact(task.assignmentType, filters.assignmentType)) return false;

  const role = filters.assigneeRole?.trim();
  if (role && task.assigneeRole.trim().toLowerCase() !== role.toLowerCase()) {
    return false;
  }

  const q = filters.q?.trim();
  if (q) {
    const hay = `${task.poNumber} ${task.title} ${task.assigneeName} ${task.assignmentType ?? ""}`;
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function filterCachedWorkflowTasks<T extends WorkflowTaskFilterRow>(
  tasks: T[],
  filters?: WorkflowTaskListFilters,
): T[] {
  if (!filters) return tasks;
  return tasks.filter((task) => matchesWorkflowTaskFilters(task, filters));
}
