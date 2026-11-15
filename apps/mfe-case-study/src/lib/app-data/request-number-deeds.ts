/**
 * The deeds that share a request number («رقم الطلب») across the work orders — the page the
 * header's request number opens (Omar 2026-11-15). Pure: no React, no I/O.
 */
import { toLatinDigits } from "@platform/ui-kit";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";

/** «١٢٣ ٤٥» and «12345» are the same request: Latin digits, no spaces. */
export function normalizeRequestNumber(raw: string | null | undefined): string {
  return toLatinDigits(raw ?? "").replace(/\s+/g, "");
}

export type RequestNumberDeed = { poNumber: string; property: PoPropertyIntake };

/**
 * Every deed whose request number is `requestNumber`, in work-order order, then the deeds' order
 * within each work order.
 * Edge cases: an empty request number matches nothing; removed deeds are kept (the list says
 * they were removed).
 */
export function deedsWithRequestNumber(
  records: readonly PoIntakeRecord[],
  requestNumber: string | null | undefined,
): RequestNumberDeed[] {
  const wanted = normalizeRequestNumber(requestNumber);
  if (!wanted) return [];
  return records
    .flatMap((record) =>
      record.properties
        .filter((property) => normalizeRequestNumber(property.requestNumber) === wanted)
        .map((property) => ({ poNumber: record.poNumber, property })),
    )
    .sort((a, b) => a.poNumber.localeCompare(b.poNumber, "en"));
}
