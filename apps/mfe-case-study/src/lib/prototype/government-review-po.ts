import type { PoIntakeRecord } from "./po-intake-data";
import { poPrimaryDataReadiness } from "./po-primary-data-readiness";
import {
  courtCityFromName,
  poCitiesForReviewerScope,
  poInReviewerScope,
  propertyCourtCity,
  type ReviewerScope,
} from "./reviewer-coverage";
import type { WorkflowTask } from "./tasks-storage";

export type GovernmentReviewPoRow = {
  poNumber: string;
  tasks: WorkflowTask[];
  openCount: number;
  propertyCount: number;
  courts: string[];
  assignmentType: string;
  primaryDataReady: boolean;
  primaryDataLabel: string;
  createdAt: string;
};

function uniqueCourtsForPo(
  record: PoIntakeRecord | undefined,
  tasks: WorkflowTask[],
): string[] {
  const courts = new Set<string>();
  for (const task of tasks) {
    const property = record?.properties.find((p) => p.id === task.propertyId);
    const court = property?.court.trim();
    if (court) courts.add(court);
  }
  if (record) {
    for (const property of record.properties) {
      const court = property.court.trim();
      if (court) courts.add(court);
    }
  }
  return [...courts].sort((a, b) => a.localeCompare(b, "ar"));
}

export function buildGovernmentReviewPoRows(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  scope: ReviewerScope | null,
): GovernmentReviewPoRow[] {
  const govTasks = tasks.filter((t) => t.kind === "government-review");
  const byPo = new Map<string, WorkflowTask[]>();

  for (const task of govTasks) {
    const key = task.poNumber.trim();
    const list = byPo.get(key) ?? [];
    list.push(task);
    byPo.set(key, list);
  }

  const rows: GovernmentReviewPoRow[] = [];

  for (const [poNumber, poTasks] of byPo) {
    const record = poByNumber.get(poNumber);
    const courts = uniqueCourtsForPo(record, poTasks);
    const cities = poCitiesForReviewerScope(record, poTasks);
    if (!poInReviewerScope(courts, scope, cities)) continue;

    const readiness = record
      ? poPrimaryDataReadiness(record)
      : {
          ready: false,
          label: "لا توجد بيانات أمر العمل",
          completeCount: 0,
          totalCount: 0,
        };

    const openCount = poTasks.filter((t) => t.status === "open").length;

    rows.push({
      poNumber,
      tasks: poTasks,
      openCount,
      propertyCount: record?.properties.length ?? poTasks.length,
      courts,
      assignmentType: record?.assignmentType ?? "—",
      primaryDataReady: readiness.ready,
      primaryDataLabel: readiness.label,
      createdAt:
        record?.createdAtUtc ??
        poTasks[0]?.createdAt ??
        "",
    });
  }

  return rows.sort((a, b) => {
    if (a.openCount !== b.openCount) return b.openCount - a.openCount;
    const createdCmp = (b.createdAt || "").localeCompare(a.createdAt || "");
    if (createdCmp !== 0) return createdCmp;
    return a.poNumber.localeCompare(b.poNumber, undefined, { numeric: true });
  });
}

export function countGovernmentReviewOpenPos(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  scope: ReviewerScope | null,
): number {
  return buildGovernmentReviewPoRows(tasks, poByNumber, scope).filter(
    (row) => row.openCount > 0,
  ).length;
}

export function propertiesForCourt(
  record: PoIntakeRecord | undefined,
  court: string,
): PoIntakeRecord["properties"] {
  if (!record) return [];
  const normalized = court.trim();
  return record.properties.filter((p) => p.court.trim() === normalized);
}

export function courtGroupsForPo(
  record: PoIntakeRecord | undefined,
  courts: string[],
): { court: string; city: string; circuit: string; propertyIds: string[] }[] {
  return courts.map((court) => {
    const properties = propertiesForCourt(record, court);
    const sample = properties[0];
    return {
      court,
      city: sample ? propertyCourtCity(sample, record) : courtCityFromName(court),
      circuit: sample?.circuit.trim() || "—",
      propertyIds: properties.map((p) => p.id),
    };
  });
}
