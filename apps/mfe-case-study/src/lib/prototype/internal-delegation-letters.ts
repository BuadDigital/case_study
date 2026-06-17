import {
  getInternalDelegationLetters,
  saveInternalDelegationLetters,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import { showsCourtFields } from "./po-intake-data";
import { propertyCourtCity } from "./reviewer-coverage";

export type InternalDelegationLetter = {
  id: string;
  poNumber: string;
  city: string;
  court: string;
  circuit: string;
  selectedPropertyIds: string[];
  createdAt: string;
};

const memoryByPo = new Map<string, InternalDelegationLetter[]>();

function letterId(poNumber: string, court: string): string {
  return `${poNumber.trim()}::${court.trim()}`;
}

function propertiesForCourt(
  record: PoIntakeRecord,
  court: string,
): PoPropertyIntake[] {
  const normalized = court.trim();
  return record.properties.filter((p) => p.court.trim() === normalized);
}

async function persistPoLetters(
  poNumber: string,
  letters: InternalDelegationLetter[],
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;
  await saveInternalDelegationLetters(config, poNumber, letters);
}

export async function hydrateInternalDelegationLetters(
  poNumber: string,
): Promise<InternalDelegationLetter[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return memoryByPo.get(poNumber.trim()) ?? [];

  const result = await getInternalDelegationLetters(config, poNumber);
  if (!result.ok) return memoryByPo.get(poNumber.trim()) ?? [];

  const letters = result.data.map((row) => ({
    id: row.id,
    poNumber: row.poNumber,
    city: row.city,
    court: row.court,
    circuit: row.circuit,
    selectedPropertyIds: row.selectedPropertyIds ?? [],
    createdAt: row.createdAt,
  }));
  memoryByPo.set(poNumber.trim(), letters);
  return letters;
}

export function syncInternalDelegationLetters(
  record: PoIntakeRecord,
): InternalDelegationLetter[] {
  if (!showsCourtFields(record.assignmentType)) return [];

  const po = record.poNumber.trim();
  const existing = memoryByPo.get(po) ?? [];
  const byId = new Map(existing.map((l) => [l.id, l]));
  const next: InternalDelegationLetter[] = [];
  const courts = new Set<string>();

  for (const property of record.properties) {
    const court = property.court.trim();
    if (!court) continue;
    courts.add(court);
  }

  for (const court of courts) {
    const properties = propertiesForCourt(record, court);
    const sample = properties[0];
    if (!sample) continue;
    const id = letterId(record.poNumber, court);
    const prior = byId.get(id);
    const propertyIds = properties.map((p) => p.id);
    const selected =
      prior?.selectedPropertyIds.filter((pid) => propertyIds.includes(pid)) ??
      propertyIds;

    next.push({
      id,
      poNumber: record.poNumber,
      city: propertyCourtCity(sample, record),
      court,
      circuit: sample.circuit.trim() || "—",
      selectedPropertyIds: selected.length > 0 ? selected : propertyIds,
      createdAt: prior?.createdAt ?? new Date().toISOString(),
    });
  }

  const poPrefix = `${po}::`;
  const merged = [
    ...existing.filter((l) => !l.id.startsWith(poPrefix)),
    ...next,
  ];
  memoryByPo.set(po, merged);
  void persistPoLetters(po, merged);
  return next;
}

export function loadInternalDelegationLetters(
  poNumber: string,
): InternalDelegationLetter[] {
  const prefix = `${poNumber.trim()}::`;
  return (memoryByPo.get(poNumber.trim()) ?? []).filter((l) =>
    l.id.startsWith(prefix),
  );
}

export function updateDelegationLetterSelection(
  letterIdValue: string,
  selectedPropertyIds: string[],
): void {
  const poNumber = letterIdValue.split("::")[0]?.trim() ?? "";
  if (!poNumber) return;

  const letters = memoryByPo.get(poNumber) ?? [];
  const idx = letters.findIndex((l) => l.id === letterIdValue);
  if (idx < 0) return;
  letters[idx] = { ...letters[idx]!, selectedPropertyIds };
  memoryByPo.set(poNumber, [...letters]);
  void persistPoLetters(poNumber, letters);
}

export function delegationLetterForCourt(
  poNumber: string,
  court: string,
  record?: PoIntakeRecord,
): InternalDelegationLetter | null {
  const letters = loadInternalDelegationLetters(poNumber);
  const found = letters.find((l) => l.court.trim() === court.trim());
  if (found) return found;
  if (!record) return null;
  const synced = syncInternalDelegationLetters(record);
  return synced.find((l) => l.court.trim() === court.trim()) ?? null;
}
