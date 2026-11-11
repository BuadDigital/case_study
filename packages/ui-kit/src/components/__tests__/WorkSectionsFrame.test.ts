import { describe, expect, it } from "vitest";
import { sectionOwnership, workSectionStatus } from "../WorkSectionsFrame";

const sections = [
  { id: "summary", title: "ملخص", step: 1 },
  { id: "basic", title: "أساليب", step: 1 },
  { id: "market", title: "مقارنة", step: 2 },
  { id: "review", title: "مراجعة", step: 5 },
] as const;

describe("sectionOwnership — whose sections a shared page holds (the rail's eye, 2026-11-11)", () => {
  const shared = [
    { id: "intake", title: "البيانات الأولية", step: 0, group: "co" },
    { id: "study", title: "تقرير دراسة الحالة", step: 4, group: "st" },
    { id: "photos", title: "صور التقرير", step: 4, group: "st" },
    { id: "upload", title: "الرفع على إنفاذ", step: 6, group: "rv" },
  ] as const;

  it("splits the page into the viewer's sections and the other sub-roles'", () => {
    expect(sectionOwnership(shared, ["st"])).toEqual({
      mine: ["study", "photos"],
      others: ["intake", "upload"],
    });
    expect(sectionOwnership(shared, ["co", "rv"])).toEqual({
      mine: ["intake", "upload"],
      others: ["study", "photos"],
    });
  });

  it("splits nothing for a viewer who holds every sub-role on the page, or none", () => {
    const nothing = { mine: [], others: [] };
    expect(sectionOwnership(shared, ["co", "st", "rv"])).toEqual(nothing);
    expect(sectionOwnership(shared, [])).toEqual(nothing);
    expect(sectionOwnership(shared, undefined)).toEqual(nothing);
  });

  it("splits nothing on a page without sub-roles (the coordinator's, the appraiser's)", () => {
    expect(sectionOwnership(sections, ["co"])).toEqual({ mine: [], others: [] });
  });

  it("leaves a section without a sub-role out of both lists — the eye never hides it", () => {
    const mixed = [...shared, { id: "notes", title: "ملاحظات", step: 6 }] as const;
    expect(sectionOwnership(mixed, ["co"])).toEqual({
      mine: ["intake"],
      others: ["study", "photos", "upload"],
    });
  });
});

describe("workSectionStatus", () => {
  it("marks every section done once the step is past them all", () => {
    expect(sections.map((s) => workSectionStatus(s, 6))).toEqual(["done", "done", "done", "done"]);
  });
});
