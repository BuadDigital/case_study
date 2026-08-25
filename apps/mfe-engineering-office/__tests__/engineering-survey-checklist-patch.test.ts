import { describe, expect, it } from "vitest";
import { patchChecklistRow } from "../src/lib/engineering-survey-submission-storage";
import { ENGINEERING_SURVEY_CHECKLIST_ITEMS } from "../src/lib/engineering-survey-data";

describe("patchChecklistRow", () => {
  it("keeps other rows when patching a note on an empty checklist", () => {
    const next = patchChecklistRow([], 0, { note: "مطابق" });
    expect(next).toHaveLength(ENGINEERING_SURVEY_CHECKLIST_ITEMS.length);
    expect(next[0]?.note).toBe("مطابق");
    expect(next[1]?.note).toBe("");
  });

  it("does not drop a previous row note when patching another index", () => {
    const first = patchChecklistRow([], 0, { note: "الأول" });
    const second = patchChecklistRow(first, 2, { note: "الثالث" });
    expect(second[0]?.note).toBe("الأول");
    expect(second[2]?.note).toBe("الثالث");
  });
});
