import { describe, expect, it } from "vitest";
import {
  circuitDisplayLabel,
  filterAndRankCircuits,
  normalizeArabicSearchText,
  stripArabicAl,
  toLatinDigits,
} from "../circuit-search";

const sample = [
  { id: "1", circuitNo: "1", circuitName: "دائرة التنفيذ الأولى" },
  { id: "5", circuitNo: "5", circuitName: "دائرة التنفيذ الخامسة" },
  { id: "11", circuitNo: "11", circuitName: "دائرة التنفيذ الحادية عشرة" },
  { id: "15", circuitNo: "15", circuitName: "دائرة التنفيذ الخامسة عشرة" },
  { id: "a", circuitNo: "الدائرة الثانية", circuitName: null },
];

describe("circuit-search", () => {
  it("normalizes arabic digits and hamza", () => {
    expect(toLatinDigits("٥")).toBe("5");
    expect(normalizeArabicSearchText("أولى")).toContain("اول");
    expect(stripArabicAl("الخامسة")).toBe("خامسه");
  });

  it("ranks exact numeric match first for 5", () => {
    const ranked = filterAndRankCircuits(sample, "5");
    expect(ranked[0]?.id).toBe("5");
    expect(ranked.map((r) => r.id)).not.toContain("15");
  });

  it("accepts arabic digit ٥", () => {
    const ranked = filterAndRankCircuits(sample, "٥");
    expect(ranked[0]?.circuitName).toContain("الخامسة");
  });

  it("prefix 1 prefers الأولى before 11", () => {
    const ranked = filterAndRankCircuits(sample, "1");
    expect(ranked[0]?.id).toBe("1");
    expect(ranked.map((r) => r.id)).toContain("11");
  });

  it("text search خامس finds الخامسة then الخامسة عشرة", () => {
    const ranked = filterAndRankCircuits(sample, "خامس");
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0]?.id).toBe("5");
    expect(ranked.map((r) => r.id)).toContain("15");
  });

  it("empty query sorts by circuit number", () => {
    const ranked = filterAndRankCircuits(sample, "");
    expect(ranked.map((r) => r.id).slice(0, 3)).toEqual(["1", "5", "11"]);
  });

  it("display prefers circuitName", () => {
    expect(circuitDisplayLabel(sample[0]!)).toBe("دائرة التنفيذ الأولى");
    expect(circuitDisplayLabel(sample[4]!)).toBe("الدائرة الثانية");
  });
});
