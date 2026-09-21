import { describe, expect, it } from "vitest";
import {
  CUSTOM_CIRCUIT_VALUE,
  CUSTOM_COURT_VALUE,
  isCustomCircuitValue,
  resolveSelectedCircuitId,
  resolveSelectedCourtId,
} from "../court-circuit-select-state";

const circuits = [
  { id: "c5", circuitNo: "5", circuitName: "دائرة التنفيذ الخامسة" },
];

describe("resolveSelectedCircuitId", () => {
  it("prefers the stored catalog id", () => {
    expect(
      resolveSelectedCircuitId({
        propertyCircuitId: "c5",
        circuit: "5",
        circuits,
      }),
    ).toBe("c5");
  });

  it("links a typed number to the catalog when no id is stored", () => {
    expect(
      resolveSelectedCircuitId({
        propertyCircuitId: "",
        circuit: "5",
        circuits,
      }),
    ).toBe("c5");
  });

  it("keeps a provisional override when the name is not in the catalog", () => {
    expect(
      resolveSelectedCircuitId({
        propertyCircuitId: "",
        circuit: "دائرة مستحدثة",
        circuits,
      }),
    ).toBe(CUSTOM_CIRCUIT_VALUE);
    expect(isCustomCircuitValue(CUSTOM_CIRCUIT_VALUE)).toBe(true);
  });
});

describe("resolveSelectedCourtId", () => {
  const courts = [{ id: "k1", name: "محكمة التنفيذ بالرياض" }];

  it("prefers the stored catalog id", () => {
    expect(
      resolveSelectedCourtId({ propertyCourtId: "k1", court: "", courts }),
    ).toBe("k1");
  });

  it("links a typed name that matches a catalog court", () => {
    expect(
      resolveSelectedCourtId({
        propertyCourtId: "",
        court: "محكمة التنفيذ بالرياض",
        courts,
      }),
    ).toBe("k1");
  });

  it("keeps a typed court that is not in the catalog as provisional", () => {
    expect(
      resolveSelectedCourtId({
        propertyCourtId: "",
        court: "محكمة التنفيذ بحفر الباطن",
        courts,
      }),
    ).toBe(CUSTOM_COURT_VALUE);
  });

  it("is empty when nothing is chosen", () => {
    expect(resolveSelectedCourtId({ propertyCourtId: "", court: " ", courts })).toBe("");
  });
});
