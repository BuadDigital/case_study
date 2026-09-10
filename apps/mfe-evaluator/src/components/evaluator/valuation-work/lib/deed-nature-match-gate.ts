import type { ValuationIssuanceGatesDto } from "@platform/api-client";

export const DEED_NATURE_MATCH_GATE_CODE = "deed_nature_match";

/** Traditional deed without مطابق — valuation calc stays closed. */
export function deedNatureMatchBlocksValuation(
  gates: ValuationIssuanceGatesDto | null | undefined,
): boolean {
  const gate = gates?.gates.find((g) => g.code === DEED_NATURE_MATCH_GATE_CODE);
  return gate != null && !gate.passed;
}

export function deedNatureMatchGateDetail(
  gates: ValuationIssuanceGatesDto | null | undefined,
): string | null {
  const gate = gates?.gates.find((g) => g.code === DEED_NATURE_MATCH_GATE_CODE);
  if (!gate || gate.passed) return null;
  return gate.detailAr?.trim() || gate.labelAr;
}
