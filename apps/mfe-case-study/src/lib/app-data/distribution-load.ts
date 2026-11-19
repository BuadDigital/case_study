import type { WorkflowTask } from "./tasks";

import { WorkflowTaskKinds, CaseStudyTaskPhases } from "@platform/app-shared/workflow/task-types";
import { Roles } from "@platform/types";
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
    case Roles.CaseSpecialist:
      return (
        task.kind === WorkflowTaskKinds.CaseStudyProperty && task.phase === CaseStudyTaskPhases.CaseStudy
      );
    case Roles.FieldInspector:
      return task.kind === WorkflowTaskKinds.FieldInspection;
    case Roles.RealEstateAppraiser:
      return task.kind === WorkflowTaskKinds.PropertyAppraisal;
    case Roles.EngineeringOffice:
      return task.kind === WorkflowTaskKinds.EngineeringSurvey;
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
