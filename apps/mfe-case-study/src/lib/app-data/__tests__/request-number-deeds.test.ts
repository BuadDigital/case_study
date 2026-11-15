import { describe, expect, it } from "vitest";
import { emptyProperty, type PoIntakeRecord } from "@platform/app-shared/app-data/po-intake-property-model";
import { isExternalPartyRole } from "../po-roles";
import { deedsWithRequestNumber, normalizeRequestNumber } from "../request-number-deeds";

const deed = (id: string, requestNumber: string, over: Record<string, unknown> = {}) => ({
  ...emptyProperty(),
  id,
  requestNumber,
  ...over,
});
const po = (poNumber: string, ...properties: ReturnType<typeof deed>[]) =>
  ({ poNumber, properties }) as unknown as PoIntakeRecord;

// Omar 2026-11-15: the header's «رقم الطلب» opens every deed carrying it.
describe("deedsWithRequestNumber", () => {
  it("gathers the deeds of every work order with the same number, work orders in order", () => {
    const records = [
      po("PO-2", deed("b1", "4455"), deed("b2", "9999")),
      po("PO-1", deed("a1", "4455"), deed("a2", "4455", { isRemoved: true })),
    ];
    expect(deedsWithRequestNumber(records, "4455").map((d) => [d.poNumber, d.property.id])).toEqual([
      ["PO-1", "a1"],
      ["PO-1", "a2"],
      ["PO-2", "b1"],
    ]);
  });

  it("reads Arabic digits and spaces as the same number", () => {
    expect(normalizeRequestNumber(" ٤٤ ٥٥ ")).toBe("4455");
    expect(deedsWithRequestNumber([po("PO-1", deed("a1", "٤٤٥٥"))], "4455")).toHaveLength(1);
  });

  it("matches nothing for an empty number, even deeds without one", () => {
    expect(deedsWithRequestNumber([po("PO-1", deed("a1", ""))], "  ")).toEqual([]);
  });
});

describe("isExternalPartyRole", () => {
  it("is the inspector, the engineering office and the government reviewer — not the appraiser or the staff", () => {
    expect(isExternalPartyRole("field-inspector")).toBe(true);
    expect(isExternalPartyRole("engineering-office")).toBe(true);
    expect(isExternalPartyRole("government-reviewer")).toBe(true);
    expect(isExternalPartyRole("real-estate-appraiser")).toBe(false);
    expect(isExternalPartyRole("case-specialist")).toBe(false);
  });
});
