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

  // فهرسة أوامر العمل ومفاتيح الصكوك مرة واحدة بدل مسح خطي لكل زوج.
  const recordByPo = new Map<string, PoIntakeRecord>();
  for (const record of poRecords) {
    const key = norm(record.poNumber);
    if (!recordByPo.has(key)) recordByPo.set(key, record);
  }

  const deedKeysByRecord = new Map<
    PoIntakeRecord,
    { property: PoIntakeRecord["properties"][number]; keys: Set<string> }[]
  >();
  const activePropertiesOf = (record: PoIntakeRecord) => {
    let entries = deedKeysByRecord.get(record);
    if (!entries) {
      entries = record.properties
        .filter((p) => !p.isRemoved)
        .map((property) => ({
          property,
          keys: new Set(deedKeysForProperty(property)),
        }));
      deedKeysByRecord.set(record, entries);
    }
    return entries;
  };

  for (const { poNumber, deed } of pairs.values()) {
    const record = recordByPo.get(poNumber);
    if (!record) continue;

    const property = activePropertiesOf(record).find((e) =>
      e.keys.has(deed),
    )?.property;
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
