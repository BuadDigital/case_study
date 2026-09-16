import {
  circuitDisplayLabel,
  findLinkedCircuit,
  type CircuitSearchItem,
} from "@platform/app-shared/domain/courts/circuit-search";

/** Select value for a typed circuit that is not in the court catalog. */
export const CUSTOM_CIRCUIT_VALUE = "__custom__";

export function isCustomCircuitValue(value: string): boolean {
  return value.trim() === CUSTOM_CIRCUIT_VALUE;
}

export function resolveSelectedCircuitId(input: {
  propertyCircuitId?: string;
  circuit: string;
  circuits: readonly CircuitSearchItem[];
}): string {
  const catalogId = input.propertyCircuitId?.trim();
  if (catalogId) return catalogId;
  const linked = findLinkedCircuit(input.circuits, input.circuit);
  if (linked) return linked.id;
  return input.circuit.trim() ? CUSTOM_CIRCUIT_VALUE : "";
}

export function circuitOptionLabel(
  circuits: readonly CircuitSearchItem[],
  id: string,
  fallback: string,
): string {
  const row = circuits.find((c) => c.id === id);
  if (row) return circuitDisplayLabel(row);
  return fallback.trim();
}
