import { describe, expect, it } from "vitest";
import {
  INSPECTED_TYPE_REASON_REQUIRED,
  INSPECTED_TYPE_REQUIRED,
  inspectedTypeChanged,
  inspectedTypeCrossingNote,
  mapInspectedTypeFieldErrors,
  planInspectedTypeCorrection,
} from "../inspected-type-correction";

const REASON = "الصك أرض فضاء والمبنى أزيل";
const current = { currentType: "فيلا", currentUsage: "سكني" };

describe("planInspectedTypeCorrection — «تعديل النوع والاستخدام»", () => {
  it("a new type needs a reason of 10 characters", () => {
    expect(
      planInspectedTypeCorrection({ ...current, nextType: "أرض سكنية", nextUsage: "سكني", reason: "قصير" }),
    ).toEqual({ ok: false, field: "reason", error: INSPECTED_TYPE_REASON_REQUIRED });
  });

  it("sends the new type with its reason, and nothing about a usage left as it is", () => {
    expect(
      planInspectedTypeCorrection({
        ...current,
        nextType: " أرض سكنية ",
        nextUsage: "سكني",
        reason: ` ${REASON} `,
      }),
    ).toEqual({ ok: true, request: { propertyType: "أرض سكنية", reason: REASON } });
  });

  it("a new usage alone needs no reason", () => {
    expect(
      planInspectedTypeCorrection({ ...current, nextType: "فيلا", nextUsage: "سكني تجاري", reason: "" }),
    ).toEqual({ ok: true, request: { propertyUsage: "سكني تجاري" } });
  });

  it("nothing changed sends nothing — an emptied usage is not a change", () => {
    expect(
      planInspectedTypeCorrection({ ...current, nextType: "فيلا", nextUsage: "", reason: "" }),
    ).toEqual({ ok: true, request: null });
  });

  it("refuses a type that is not on the system's list", () => {
    expect(
      planInspectedTypeCorrection({ ...current, nextType: "نوع غير موجود", nextUsage: "سكني", reason: REASON }),
    ).toEqual({ ok: false, field: "propertyType", error: INSPECTED_TYPE_REQUIRED });
  });

  it("a usage that held an old classification counts as empty, so a real one is a change", () => {
    expect(
      planInspectedTypeCorrection({
        currentType: "فيلا",
        currentUsage: "مبنى مفرد",
        nextType: "فيلا",
        nextUsage: "سكني",
        reason: "",
      }),
    ).toEqual({ ok: true, request: { propertyUsage: "سكني" } });
  });
});

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

describe("inspectedTypeChanged / mapInspectedTypeFieldErrors", () => {
  it("compares the trimmed names and ignores an empty choice", () => {
    expect(inspectedTypeChanged("فيلا", " فيلا ")).toBe(false);
    expect(inspectedTypeChanged("فيلا", "")).toBe(false);
    expect(inspectedTypeChanged("فيلا", "عمارة")).toBe(true);
  });

  it("keeps only the dialog's fields from a server refusal", () => {
    expect(mapInspectedTypeFieldErrors({ reason: "سبب", _: "عام" })).toEqual({
      propertyType: undefined,
      propertyUsage: undefined,
      reason: "سبب",
    });
    expect(mapInspectedTypeFieldErrors(undefined).reason).toBeUndefined();
  });
});
