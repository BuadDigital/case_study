import { describe, expect, it } from "vitest";
import {
  areaKindForItemName,
  costGroupOf,
  costItemForTypedName,
  effectiveStructureKind,
} from "../cost-items";

describe("areaKindForItemName — floor-like names outside the catalog (A→Z #30/#52/#90)", () => {
  it("reads floors, annexes and basements whatever the article or hamza", () => {
    for (const name of ["الدور الثاني", "دور ثاني", "الطابق الثالث", "الميزانين", "ميزانين", "مسطح الدور الأول", "مساحة المحل"]) {
      expect(areaKindForItemName(name), name).toBe("floor");
    }
    for (const name of ["ملحق علوي", "الملحق العلوى", "ملحق السطح", "ملاحق خارجية"]) {
      expect(areaKindForItemName(name), name).toBe("annex");
    }
    for (const name of ["القبو", "البدروم", "سرداب"]) {
      expect(areaKindForItemName(name), name).toBe("basement");
    }
  });

  it("matches whole words only", () => {
    for (const name of ["دورة مياه", "مكتبة", "عزل السطح", "غرفة حارس", "المسبح", "", "  "]) {
      expect(areaKindForItemName(name), name).toBeNull();
    }
  });
});

describe("costItemForTypedName", () => {
  it("finds the catalog item without «ال» or hamza (A→Z #34)", () => {
    expect(costItemForTypedName("سور")?.key).toBe("fence");
    expect(costItemForTypedName("ملحق علوي")?.key).toBe("upper_annex");
    expect(costItemForTypedName("دور ارضي")?.key).toBe("ground_floor");
    expect(costItemForTypedName("الدور الثاني")).toBeUndefined();
    expect(costItemForTypedName("بند مخصص")).toBeUndefined();
  });
});

describe("costGroupOf", () => {
  it("puts a custom «other» line named as a floor in the floor areas", () => {
    expect(costGroupOf({ itemKey: "custom", structureKind: "other", label: "الدور الثاني" })).toBe("area");
    expect(costGroupOf({ itemKey: "custom", structureKind: "other", label: "ملحق علوي" })).toBe("area");
    expect(costGroupOf({ itemKey: "custom", structureKind: "", label: "الميزانين" })).toBe("area");
  });

  it("counts custom annex and basement kinds as area, keeps fences and other names as extras", () => {
    expect(costGroupOf({ itemKey: "custom", structureKind: "annex", label: "غرفة" })).toBe("area");
    expect(costGroupOf({ itemKey: "custom", structureKind: "basement", label: "" })).toBe("area");
    expect(costGroupOf({ itemKey: "custom", structureKind: "fence", label: "الدور" })).toBe("extra");
    expect(costGroupOf({ itemKey: "custom", structureKind: "other", label: "مظلة سيارات" })).toBe("extra");
    expect(costGroupOf({ itemKey: "pool", structureKind: "other", label: "المسبح" })).toBe("extra");
    expect(costGroupOf({ itemKey: "ground_floor", structureKind: "floor", label: "" })).toBe("area");
  });
});

describe("effectiveStructureKind", () => {
  it("keeps a saved kind and reads a custom «other» line by its name", () => {
    expect(effectiveStructureKind({ itemKey: "custom", structureKind: "other", label: "الدور الثاني" })).toBe("floor");
    expect(effectiveStructureKind({ itemKey: "custom", structureKind: "fence", label: "الدور الثاني" })).toBe("fence");
    expect(effectiveStructureKind({ itemKey: "first_floor", structureKind: "floor", label: "x" })).toBe("floor");
    expect(effectiveStructureKind({ itemKey: "custom", structureKind: "other", label: "غرفة حارس" })).toBe("other");
  });
});
