import { describe, expect, it } from "vitest";
import {
  inspectedTypeChanged,
  inspectedTypeCrossingNote,
} from "../inspected-type-correction";

describe("inspectedTypeCrossingNote", () => {
  it("says the building answers are hidden, not deleted, when a built type becomes land", () => {
    expect(inspectedTypeCrossingNote("فيلا", "أرض سكنية")).toContain("تُخفى ولا تُحذف");
  });

  it("says the building answers show again, and the missing ones are asked, when land becomes a built type", () => {
    expect(inspectedTypeCrossingNote("أرض سكنية", "فيلا")).toContain("ما لم يُدخله المعاين");
  });

  it("says nothing when the change stays on one side, or there is none", () => {
    expect(inspectedTypeCrossingNote("فيلا", "عمارة")).toBeNull();
    expect(inspectedTypeCrossingNote("أرض سكنية", "أرض تجارية")).toBeNull();
    expect(inspectedTypeCrossingNote("فيلا", "فيلا")).toBeNull();
  });
});

describe("inspectedTypeChanged", () => {
  it("compares the trimmed names and ignores an empty choice", () => {
    expect(inspectedTypeChanged("فيلا", " فيلا ")).toBe(false);
    expect(inspectedTypeChanged("فيلا", "")).toBe(false);
    expect(inspectedTypeChanged("فيلا", "عمارة")).toBe(true);
  });
});
