import { describe, expect, it } from "vitest";
import { findLinkedCircuit } from "../circuit-search";

const sample = [
  { id: "1", circuitNo: "1", circuitName: "دائرة التنفيذ الأولى" },
  { id: "5", circuitNo: "5", circuitName: "دائرة التنفيذ الخامسة" },
  { id: "15", circuitNo: "15", circuitName: "دائرة التنفيذ الخامسة عشرة" },
];

describe("findLinkedCircuit", () => {
  it("links an exact circuit number, including Arabic digits", () => {
    expect(findLinkedCircuit(sample, "5")?.id).toBe("5");
    expect(findLinkedCircuit(sample, "٥")?.id).toBe("5");
    expect(findLinkedCircuit(sample, "15")?.id).toBe("15");
  });

  it("does not treat a prefix or partial name as a link", () => {
    expect(findLinkedCircuit(sample, "1")?.id).toBe("1");
    expect(findLinkedCircuit(sample, "خامس")).toBeNull();
  });

  it("links the full displayed Arabic name", () => {
    expect(findLinkedCircuit(sample, "دائرة التنفيذ الخامسة")?.id).toBe("5");
  });
});
