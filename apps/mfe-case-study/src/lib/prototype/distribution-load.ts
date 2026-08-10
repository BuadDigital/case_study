import type { RoleId } from "@platform/types";
import type { WorkflowTask } from "./tasks-storage";

/** Open queue statuses — same idea as reporting team-load / active queues. */
function isActiveWorkloadStatus(status: string): boolean {
  return status === "open" || status === "blocked";
}

/**
 * Whether this task counts toward an assignee's property/work load
 * on the distribution screens (aligned with reporting MatchesTeamLoadTask,
 * plus property-appraisal for valuators).
 */
export function taskCountsTowardDistributionLoad(task: WorkflowTask): boolean {
  if (!isActiveWorkloadStatus(task.status)) return false;
  const role = task.assigneeRole;
  switch (role) {
    case "case-specialist":
      return (
        task.kind === "case-study-property" && task.phase === "case-study"
      );
    case "field-inspector":
      return task.kind === "field-inspection";
    case "real-estate-appraiser":
      return task.kind === "property-appraisal";
    case "engineering-office":
      return task.kind === "engineering-survey";
    default:
      return false;
  }
}

/** Open property/task counts keyed by distribution assignee id (e.g. cs-osama). */
export function buildAssigneeOpenLoadMap(
  tasks: readonly WorkflowTask[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (!taskCountsTowardDistributionLoad(task)) continue;
    const id = task.assigneeId?.trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export function openLoadForAssignee(
  loadByAssignee: Map<string, number>,
  assigneeId: string,
): number {
  return loadByAssignee.get(assigneeId.trim()) ?? 0;
}

/** Arabic label for open property count next to a person's name. */
export function formatOpenPropertyLoadLabel(count: number): string {
  if (count <= 0) return "متاح — لا عبء حالياً";
  if (count === 1) return "عقار واحد";
  if (count === 2) return "عقاران";
  if (count >= 3 && count <= 10) return `${count} عقارات`;
  return `${count} عقارًا`;
}

export function withOpenLoadLabel(
  baseLabel: string,
  count: number,
): string {
  return `${baseLabel} · ${formatOpenPropertyLoadLabel(count)}`;
}

/** Optional capacity ceilings from reporting dashboard (for tone/badges later). */
export const DISTRIBUTION_LOAD_CAPACITY: Partial<Record<RoleId, number>> = {
  "case-specialist": 20,
  "field-inspector": 12,
  "engineering-office": 10,
  "government-reviewer": 15,
  "real-estate-appraiser": 15,
};
