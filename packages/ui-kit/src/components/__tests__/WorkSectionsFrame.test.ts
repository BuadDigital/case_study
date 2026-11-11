import { describe, expect, it } from "vitest";
import { sectionsOpenAtStep, workSectionStatus } from "../WorkSectionsFrame";

const sections = [
  { id: "summary", title: "ملخص", step: 1 },
  { id: "basic", title: "أساليب", step: 1 },
  { id: "market", title: "مقارنة", step: 2 },
  { id: "review", title: "مراجعة", step: 5 },
] as const;

describe("sectionsOpenAtStep", () => {
  it("opens the sections of the step, together", () => {
    expect(sectionsOpenAtStep(sections, 1)).toEqual(["summary", "basic"]);
    expect(sectionsOpenAtStep(sections, 2, "summary")).toEqual(["market"]);
  });

  it("opens nothing for a step past every section — unless a fallback is named", () => {
    expect(sectionsOpenAtStep(sections, 6)).toEqual([]);
    expect(sectionsOpenAtStep(sections, 6, "summary")).toEqual(["summary"]);
  });

  it("ignores a fallback that is not one of the sections", () => {
    expect(sectionsOpenAtStep(sections, 6, "missing" as "summary")).toEqual([]);
  });
});

describe("workSectionStatus", () => {
  it("marks every section done once the step is past them all", () => {
    expect(sections.map((s) => workSectionStatus(s, 6))).toEqual(["done", "done", "done", "done"]);
  });
});
