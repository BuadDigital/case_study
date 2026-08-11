import type { OperationsTask } from "./operations-tasks-storage";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "./po-intake-data";

export type OperationsTaskFailureTarget = {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
};

function norm(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function deedKeysForProperty(
  property: PoIntakeRecord["properties"][number],
): string[] {
  return [
    formatPropertyDeedDisplay(property),
    property.deedNumber,
    property.realEstateRegNumber ?? "",
  ]
    .map(norm)
    .filter(Boolean);
}

/**
 * Resolve property targets for raising a failure from an operations task.
 * Court visits / work-order tasks link PO + deed(s) without a wire propertyId.
 */
export function failureTargetsForOperationsTask(
  task: OperationsTask,
  poRecords: PoIntakeRecord[],
): OperationsTaskFailureTarget[] {
  const pairs = new Map<string, { poNumber: string; deed: string }>();

  const addPair = (poNumber: string, deed: string) => {
    const po = norm(poNumber);
    const d = norm(deed);
    if (!po || !d || d === "—") return;
    pairs.set(`${po}::${d}`, { poNumber: po, deed: d });
  };

  for (const row of task.letterRows ?? []) {
    addPair(row.po, row.deed);
  }

  const taskPo = norm(task.poNumber);
  if (taskPo) {
    for (const deed of task.deeds ?? []) {
      addPair(taskPo, deed);
    }
  }

  const byPropertyId = new Map<string, OperationsTaskFailureTarget>();

  for (const { poNumber, deed } of pairs.values()) {
    const record = poRecords.find(
      (r) => norm(r.poNumber) === poNumber,
    );
    if (!record) continue;

    const property = record.properties.find((p) => {
      if (p.isRemoved) return false;
      return deedKeysForProperty(p).includes(deed);
    });
    if (!property) continue;

    if (byPropertyId.has(property.id)) continue;
    byPropertyId.set(property.id, {
      poNumber,
      propertyId: property.id,
      deedNumber: formatPropertyDeedDisplay(property) || deed,
    });
  }

  return [...byPropertyId.values()];
}
