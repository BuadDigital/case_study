import {
  getInternalDelegationLetters,
  issueInternalDelegationLetter,
  saveInternalDelegationLetters,
  type DelegationLetterAgentDto,
  type DelegationLetterPropertyDto,
  type InternalDelegationLetterDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  formatPropertyDeedDisplay,
  showsCourtFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "./po-intake-data";
import { propertyCourtCity } from "./reviewer-coverage";

export type DelegationLetterProperty = DelegationLetterPropertyDto;

export type DelegationAgentInfo = DelegationLetterAgentDto;

export type InternalDelegationLetter = {
  id: string;
  city: string;
  court: string;
  circuit: string;
  selectedProperties: DelegationLetterProperty[];
  /** كل أوامر العمل التي تخص هذه المحكمة + الدائرة — ثابتة للفلترة/العرض. */
  poNumbers: string[];
  reference?: string;
  dateHijri?: string;
  dateGreg?: string;
  issuedAt?: string;
  agent?: DelegationAgentInfo;
  issuedProperties?: DelegationLetterProperty[];
  createdAt: string;
};

const memoryByScope = new Map<string, InternalDelegationLetter[]>();

export function letterIdForCourtCircuit(court: string, circuit: string): string {
  return `${court.trim()}::${circuit.trim() || "—"}`;
}

function toLetter(row: InternalDelegationLetterDto): InternalDelegationLetter {
  const selected = row.selectedProperties ?? [];
  const issued = row.issuedProperties ?? undefined;
  const poNumbers = [
    ...new Set(
      [...(issued ?? []), ...selected]
        .map((p) => p.workOrder.trim())
        .filter(Boolean),
    ),
  ];
  return {
    id: row.id,
    city: row.city,
    court: row.court,
    circuit: row.circuit,
    selectedProperties: selected,
    poNumbers,
    reference: row.reference ?? undefined,
    dateHijri: row.dateHijri ?? undefined,
    dateGreg: row.dateGreg ?? undefined,
    issuedAt: row.issuedAt ?? undefined,
    agent: row.agent ?? undefined,
    issuedProperties: issued,
    createdAt: row.createdAt,
  };
}

function propertyRow(
  record: PoIntakeRecord,
  property: PoPropertyIntake,
): DelegationLetterProperty {
  return {
    propertyId: property.id,
    workOrder: record.poNumber.trim(),
    deedNo: formatPropertyDeedDisplay(property) || property.deedNumber.trim() || "—",
    owner: property.ownerName.trim() || "—",
    requestNo: property.requestNumber.trim() || "—",
  };
}

async function persistScopeLetters(
  scopeKey: string,
  letters: InternalDelegationLetter[],
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;
  await saveInternalDelegationLetters(config, scopeKey, letters);
}

export function agentInfoFromStaff(user: StaffUser | null | undefined): DelegationAgentInfo {
  const reg = user?.registration ?? {};
  const nationality =
    reg.nationality?.trim() ||
    reg.الجنسية?.trim() ||
    "—";
  const nationalId =
    reg.nationalId?.trim() ||
    reg.national_id?.trim() ||
    reg.الهوية?.trim() ||
    reg.idNumber?.trim() ||
    "—";
  return {
    name: user?.name?.trim() || "—",
    nationality,
    nationalId,
    mobile: user?.phone?.trim() || "—",
  };
}

export async function hydrateInternalDelegationLetters(
  scopeKey: string,
): Promise<InternalDelegationLetter[]> {
  const key = scopeKey.trim();
  const config = prototypeModulesApiConfig();
  if (!config) return memoryByScope.get(key) ?? [];

  const result = await getInternalDelegationLetters(config, key);
  if (!result.ok) return memoryByScope.get(key) ?? [];

  const letters = result.data.map(toLetter);
  memoryByScope.set(key, letters);
  return letters;
}

/**
 * يبني خطابات حسب (محكمة + دائرة) عبر كل أوامر العمل المعطاة.
 * يحافظ على الاختيارات والخطابات المُصدَرة السابقة.
 */
export function syncInternalDelegationLetters(
  records: PoIntakeRecord[],
  scopeKey: string,
): InternalDelegationLetter[] {
  const key = scopeKey.trim();
  if (!key) return [];

  const eligible = records.filter((r) => showsCourtFields(r.assignmentType));
  const existing = memoryByScope.get(key) ?? [];
  const byId = new Map(existing.map((l) => [l.id, l]));

  type Acc = {
    city: string;
    court: string;
    circuit: string;
    properties: DelegationLetterProperty[];
  };
  const groups = new Map<string, Acc>();

  for (const record of eligible) {
    for (const property of record.properties) {
      const court = property.court.trim();
      if (!court) continue;
      const circuit = property.circuit.trim() || "—";
      const id = letterIdForCourtCircuit(court, circuit);
      const row = propertyRow(record, property);
      const acc = groups.get(id);
      if (acc) {
        if (!acc.properties.some((p) => p.propertyId === row.propertyId)) {
          acc.properties.push(row);
        }
      } else {
        groups.set(id, {
          city: propertyCourtCity(property, record),
          court,
          circuit,
          properties: [row],
        });
      }
    }
  }

  const next: InternalDelegationLetter[] = [];
  for (const [id, group] of groups) {
    const groupPoNumbers = [
      ...new Set(group.properties.map((p) => p.workOrder.trim()).filter(Boolean)),
    ];
    const prior = byId.get(id);
    if (prior?.reference) {
      next.push({ ...prior, poNumbers: groupPoNumbers });
      continue;
    }

    const availableIds = new Set(group.properties.map((p) => p.propertyId));
    const priorSelected = prior?.selectedProperties ?? [];
    const kept = priorSelected.filter((p) => availableIds.has(p.propertyId));
    const selected =
      kept.length > 0
        ? kept.map((p) => {
            const fresh = group.properties.find((x) => x.propertyId === p.propertyId);
            return fresh ?? p;
          })
        : group.properties;

    next.push({
      id,
      city: group.city,
      court: group.court,
      circuit: group.circuit,
      selectedProperties: selected,
      poNumbers: groupPoNumbers,
      createdAt: prior?.createdAt ?? new Date().toISOString(),
    });
  }

  // أبقِ المُصدَر الذي لم يعد له عقارات حالية في النطاق.
  for (const prior of existing) {
    if (prior.reference && !next.some((l) => l.id === prior.id)) {
      next.push(prior);
    }
  }

  memoryByScope.set(key, next);
  void persistScopeLetters(key, next);
  return next;
}

export function loadInternalDelegationLetters(
  scopeKey: string,
): InternalDelegationLetter[] {
  return memoryByScope.get(scopeKey.trim()) ?? [];
}

export function updateDelegationLetterSelection(
  scopeKey: string,
  letterIdValue: string,
  selectedProperties: DelegationLetterProperty[],
): void {
  const key = scopeKey.trim();
  const letters = memoryByScope.get(key) ?? [];
  const idx = letters.findIndex((l) => l.id === letterIdValue);
  if (idx < 0) return;
  if (letters[idx]?.reference) return;
  letters[idx] = { ...letters[idx]!, selectedProperties };
  memoryByScope.set(key, [...letters]);
  void persistScopeLetters(key, letters);
}

export function lettersForFocusPo(
  scopeKey: string,
  focusPoNumber: string | null | undefined,
): InternalDelegationLetter[] {
  const all = loadInternalDelegationLetters(scopeKey);
  const po = focusPoNumber?.trim();
  if (!po) return all;
  // الفلترة على انتماء ثابت (كل أوامر المحكمة+الدائرة) لا على الاختيار المتغيّر.
  return all.filter((letter) => {
    if (letter.poNumbers.includes(po)) return true;
    // احتياط للخطابات المُصدَرة قبل إضافة poNumbers.
    return (letter.issuedProperties ?? letter.selectedProperties).some(
      (p) => p.workOrder.trim() === po,
    );
  });
}

export async function issueAndPrintDelegationLetter(
  scopeKey: string,
  letter: InternalDelegationLetter,
  agent: DelegationAgentInfo,
): Promise<InternalDelegationLetter | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const key = scopeKey.trim();
  const letters = memoryByScope.get(key) ?? [];
  const idx = letters.findIndex((l) => l.id === letter.id);
  const draft: InternalDelegationLetter = {
    ...letter,
    selectedProperties: letter.selectedProperties,
  };
  if (idx >= 0) letters[idx] = draft;
  else letters.push(draft);
  memoryByScope.set(key, [...letters]);
  await persistScopeLetters(key, letters);

  const result = await issueInternalDelegationLetter(config, {
    scopeKey: key,
    letterId: letter.id,
    selectedProperties: letter.selectedProperties,
    agent,
    city: letter.city,
    court: letter.court,
    circuit: letter.circuit,
  });
  if (!result.ok) return null;

  const issued = toLetter(result.data);
  // احتفظ بانتماء المحكمة+الدائرة الكامل (الخادم يرجّع المختارة فقط).
  issued.poNumbers = [
    ...new Set([...(letter.poNumbers ?? []), ...issued.poNumbers]),
  ];
  const next = memoryByScope.get(key) ?? [];
  const at = next.findIndex((l) => l.id === issued.id);
  if (at >= 0) next[at] = issued;
  else next.push(issued);
  memoryByScope.set(key, [...next]);
  return issued;
}

/** @deprecated استخدم letterIdForCourtCircuit + load */
export function delegationLetterForCourt(
  _poNumber: string,
  court: string,
  _record?: PoIntakeRecord,
): InternalDelegationLetter | null {
  for (const letters of memoryByScope.values()) {
    const found = letters.find((l) => l.court.trim() === court.trim());
    if (found) return found;
  }
  return null;
}
