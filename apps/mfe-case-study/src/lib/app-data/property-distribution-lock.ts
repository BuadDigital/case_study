import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import type { PoPropertyIntake } from "./po-intake-data";
import { caseStudyTaskForProperty } from "./tasks-reads";

/**
 * The distribution lock (Omar 2026-11-15, option 2): once the deed is distributed to the parties, the
 * initial-data fields they work from cannot change — the deed / registry number and date, the
 * boundaries, the map link, and the type and classification. Contacts, the request number, the
 * documents, the owner and the court stay editable. The server refuses the same keys
 * (PropertyDistributionLockRules); this side greys them out and drops their patches.
 * Changed 2026-11-17 (Omar): the area left the lock. The case specialist and the assigned appraiser
 * correct it after the distribution; the change log records it and the parties are not notified.
 */
export const DISTRIBUTION_LOCKED_KEYS: ReadonlySet<keyof PoPropertyIntake> = new Set<keyof PoPropertyIntake>([
  "identifierType",
  "deedNumber",
  "deedDate",
  "realEstateRegNumber",
  "realEstateRegDate",
  "locationMapUrl",
  "propertyType",
  "classification",
  "boundariesAvailability",
  "boundariesExternalDocName",
  "northBoundary", "northBoundaryLengthM", "northBoundaryType", "northFacadeFinishing",
  "southBoundary", "southBoundaryLengthM", "southBoundaryType", "southFacadeFinishing",
  "eastBoundary", "eastBoundaryLengthM", "eastBoundaryType", "eastFacadeFinishing",
  "westBoundary", "westBoundaryLengthM", "westBoundaryType", "westFacadeFinishing",
]);

/** The line under a locked field. */
export const DISTRIBUTION_LOCKED_HINT = "مقفل بعد توزيع المعاملة على الأطراف";

/** The phases at and after the confirmed distribution. */
const DISTRIBUTED_PHASES: ReadonlySet<string> = new Set(["case-study", "obstruction", "done"]);

/**
 * Whether the deed's distribution to the parties is confirmed.
 *
 * How it works: the deed's case-study task is in case study or past it (obstruction, done) — the
 * same test as the server's IsDistributedAsync. Edge cases: no task yet (a draft, or the task list
 * still loading) → not distributed; the server still refuses a locked change if the list was stale.
 */
export function isPropertyDistributed(
  poNumber: string,
  propertyId: string,
  tasks: readonly WorkflowTask[],
): boolean {
  const task = caseStudyTaskForProperty(poNumber, propertyId, [...tasks]);
  return Boolean(task && DISTRIBUTED_PHASES.has(task.phase));
}

/**
 * «التعديل» lifts the lock (Omar 2026-11-18): while the deed's transaction has an active reopening that
 * reopened the study, the locked fields are editable again (a wrong deed number is corrected then).
 *
 * How it works: any reopening not closed, with the study reopened, on this deed or on its transaction —
 * the same test as the server's HasActiveStudyReopeningAsync. Edge cases: the list still loading → the
 * lock stays (the server is the judge either way).
 */
export function editLiftsDistributionLock(
  reopenings: readonly { propertyId: string; transactionId: string; reopensStudy: boolean; status: string }[],
  propertyId: string,
  transactionId: string | null | undefined,
): boolean {
  return reopenings.some(
    (r) =>
      r.reopensStudy &&
      r.status !== "closed" &&
      (r.propertyId === propertyId || (Boolean(transactionId) && r.transactionId === transactionId)),
  );
}

/**
 * The property a whole-object replace may write: under the lock the locked keys keep the current
 * values (a prior-PO clone must not bring another deed's number, area or boundaries).
 * Edge cases: the area is kept too, although it is no longer locked (2026-11-17). Typing it is a
 * correction of this deed; a clone would carry another deed's.
 */
export function keepDistributionLockedFields(
  current: PoPropertyIntake,
  next: PoPropertyIntake,
): PoPropertyIntake {
  const kept = { ...next } as Record<string, unknown>;
  for (const key of [...DISTRIBUTION_LOCKED_KEYS, "area" as const]) kept[key] = current[key];
  return kept as PoPropertyIntake;
}
