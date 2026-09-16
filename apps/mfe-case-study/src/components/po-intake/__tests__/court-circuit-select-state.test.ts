import { describe, expect, it } from "vitest";
import {
  CUSTOM_CIRCUIT_VALUE,
  isCustomCircuitValue,
  resolveSelectedCircuitId,
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
