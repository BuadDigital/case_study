import { describe, expect, it } from "vitest";
import {
  boundaryDeedDisplay,
  boundaryMatchPatch,
  canPinInspectorMap,
  deedVerdictHeadline,
  deedVerdictPatch,
  inspectionContextOf,
  inspectorErrorLinks,
  inspectorMapCoordsLabel,
  inspectorServiceMeters,
  newerInspectorDraft,
  resolvedBoundaryDeedField,
} from "../field-inspection-work-state";
import type { InspectorWorkspaceDraft } from "../../../lib/app-data/inspector-workspace-data";
import type { InspectorWorkspaceFieldErrors } from "../../../lib/app-data/inspector-workspace-validation";

const boundaryMatches = {
  north: { facade: "شارع", matches: true, mismatchNote: "" },
  south: { facade: "", matches: false, mismatchNote: "أقصر بمترين" },
  east: { facade: "", matches: true, mismatchNote: "" },
  west: { facade: "", matches: true, mismatchNote: "" },
} as InspectorWorkspaceDraft["boundaryMatches"];

describe("boundaryMatchPatch", () => {
  it("changes only the targeted row and keeps the others by reference", () => {
    const patch = boundaryMatchPatch({ boundaryMatches }, "south", { matches: true });
    expect(patch.boundaryMatches.south).toEqual({
      facade: "",
      matches: true,
      mismatchNote: "أقصر بمترين",
    });
    expect(patch.boundaryMatches.north).toBe(boundaryMatches.north);
    expect(patch.boundaryMatches.east).toBe(boundaryMatches.east);
  });

  it("does not mutate the source draft", () => {
    boundaryMatchPatch({ boundaryMatches }, "north", { facade: "ممر" });
    expect(boundaryMatches.north.facade).toBe("شارع");
  });
});

describe("resolvedBoundaryDeedField", () => {
  it("prefers the inspector draft when it has text", () => {
    expect(resolvedBoundaryDeedField(" شارع 20م ", "قطعة")).toBe(" شارع 20م ");
  });

  it("falls back to the specialist/PO value when the draft is blank", () => {
    expect(resolvedBoundaryDeedField("", "قطعة")).toBe("قطعة");
    expect(resolvedBoundaryDeedField("   ", "قطعة")).toBe("قطعة");
    expect(resolvedBoundaryDeedField(undefined, "قطعة")).toBe("قطعة");
    expect(resolvedBoundaryDeedField(undefined, undefined)).toBe("");
  });
});

describe("boundaryDeedDisplay", () => {
  it("prints deed text and length in metres", () => {
    expect(boundaryDeedDisplay(" شارع عرض ١٥ ", " 25 ")).toEqual({
      desc: "شارع عرض ١٥",
      length: "25 م",
    });
  });

  it("falls back to a dash for blank or missing values", () => {
    expect(boundaryDeedDisplay(undefined, "   ")).toEqual({ desc: "—", length: "—" });
  });
});

describe("inspectorServiceMeters", () => {
  it("unlocks nothing without electricity or water", () => {
    expect(inspectorServiceMeters(["هاتف", "صرف صحي"])).toEqual({
      electricity: false,
      water: false,
      any: false,
    });
  });

  it("unlocks the matching meter fields", () => {
    expect(inspectorServiceMeters(["كهرباء"])).toEqual({
      electricity: true,
      water: false,
      any: true,
    });
    expect(inspectorServiceMeters(["ماء", "كهرباء"])).toEqual({
      electricity: true,
      water: true,
      any: true,
    });
  });
});

describe("map pin helpers", () => {
  it("labels the coordinates only when both halves exist", () => {
    expect(inspectorMapCoordsLabel("21.5", "39.2")).toBe("21.5, 39.2");
    expect(inspectorMapCoordsLabel("21.5", "")).toBe("—");
    expect(inspectorMapCoordsLabel("", "")).toBe("—");
  });

  it("offers the pin button once both coordinates are filled and nothing is pinned", () => {
    expect(canPinInspectorMap("21.5", "39.2", false)).toBe(true);
    expect(canPinInspectorMap("21.5", "39.2", true)).toBe(false);
    expect(canPinInspectorMap("  ", "39.2", false)).toBe(false);
  });
});

describe("inspectionContextOf", () => {
  it("collects the land-vs-building facts from draft and property", () => {
    expect(
      inspectionContextOf(
        { vacantLand: true, featureValues: { assetSubject: "أرض" } },
        { classification: "سكني", propertyType: "أرض" },
      ),
    ).toEqual({
      vacantLand: true,
      assetSubject: "أرض",
      classification: "سكني",
      propertyType: "أرض",
    });
  });

  it("tolerates a property that has not loaded", () => {
    expect(
      inspectionContextOf({ vacantLand: false, featureValues: {} }, undefined),
    ).toEqual({
      vacantLand: false,
      assetSubject: undefined,
      classification: undefined,
      propertyType: undefined,
    });
  });
});

describe("inspectorErrorLinks — land structures question", () => {
  it("routes the land answer error to the question", () => {
    const errors = {
      landHasValuableStructures: "حدّد هل في الأرض مبانٍ أو ملاحق تستحق التقييم",
    } as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([
      {
        key: "landHasValuableStructures",
        message: "حدّد هل في الأرض مبانٍ أو ملاحق تستحق التقييم",
        targetId: "ins-land-structures",
      },
    ]);
  });
});

describe("inspectorErrorLinks", () => {
  it("routes feature errors to the first empty feature field", () => {
    const errors = {
      features: "أكمل الخصائص",
      emptyFeatureKeys: ["floors", "age"],
      mapLatitude: "حدد الموقع",
    } as unknown as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([
      { key: "mapLatitude", message: "حدد الموقع", targetId: "ins-map-section" },
      { key: "features", message: "أكمل الخصائص", targetId: "ins-feature-floors" },
    ]);
  });

  it("routes defined-photo, observation, and boundary errors to the missing control", () => {
    const errors = {
      definedPhotos: "أرفق صورة الخدمة",
      missingDefinedPhotoSlotId: "service:مياه",
      observations: "كل ملاحظة يجب أن تتضمن شرحاً",
      missingObservationId: "obs-1",
      boundaries: "أضف ملاحظة عدم التطابق",
      missingBoundaryKey: "south",
    } as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([
      {
        key: "definedPhotos",
        message: "أرفق صورة الخدمة",
        targetId: "ins-defined-slot-service:مياه",
      },
      {
        key: "boundaries",
        message: "أضف ملاحظة عدم التطابق",
        targetId: "ins-boundary-south",
      },
      {
        key: "observations",
        message: "كل ملاحظة يجب أن تتضمن شرحاً",
        targetId: "ins-observation-obs-1",
      },
    ]);
  });

  it("routes free-photo and component-photo errors to the missing control", () => {
    const errors = {
      freePhotos: "أرفق صوراً إضافية",
      componentPhotos: "يجب إرفاق صورة المعرض",
      missingComponentPhotoKey: "showroom",
    } as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([
      {
        key: "freePhotos",
        message: "أرفق صوراً إضافية",
        targetId: "ins-property-photos",
      },
      {
        key: "componentPhotos",
        message: "يجب إرفاق صورة المعرض",
        targetId: "ins-component-photo-showroom",
      },
    ]);
  });

  it("routes the deed-match verdict to its control, before the boundaries row", () => {
    const errors = {
      boundaries: "أشِر إلى الضلع غير المطابق",
      deedMatchesNature: "اختر هل حدود الصك مطابقة للطبيعة أم لا",
    } as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([
      {
        key: "deedMatchesNature",
        message: "اختر هل حدود الصك مطابقة للطبيعة أم لا",
        targetId: "ins-deed-match",
      },
      {
        key: "boundaries",
        message: "أشِر إلى الضلع غير المطابق",
        targetId: "ins-boundaries-section",
      },
    ]);
  });

  it("skips non-string entries", () => {
    const errors = { emptyFeatureKeys: ["x"] } as unknown as InspectorWorkspaceFieldErrors;
    expect(inspectorErrorLinks(errors)).toEqual([]);
  });
});

describe("newerInspectorDraft", () => {
  const older = { updatedAtUtc: "2026-09-01T10:00:00Z" } as InspectorWorkspaceDraft;
  const newer = { updatedAtUtc: "2026-09-01T10:00:05Z" } as InspectorWorkspaceDraft;

  it("keeps the previous draft when the incoming one is older", () => {
    expect(newerInspectorDraft(newer, older)).toBe(newer);
  });

  it("takes the incoming draft when it is newer or timestamps are unparsable", () => {
    expect(newerInspectorDraft(older, newer)).toBe(newer);
    expect(newerInspectorDraft(null, older)).toBe(older);
    const junk = { updatedAtUtc: "n/a" } as InspectorWorkspaceDraft;
    expect(newerInspectorDraft(newer, junk)).toBe(junk);
  });
});

describe("deedVerdictPatch", () => {
  it("yes sets all four sides matching and clears notes in one patch", () => {
    const patch = deedVerdictPatch({ boundaryMatches }, "yes");
    expect(patch.deedMatchesNature).toBe("yes");
    for (const key of ["north", "south", "east", "west"] as const) {
      expect(patch.boundaryMatches[key].matches).toBe(true);
      expect(patch.boundaryMatches[key].mismatchNote).toBe("");
    }
    expect(patch.boundaryMatches.north.facade).toBe("شارع");
  });

  it("no keeps the sides' answers and starts an untouched side as matching", () => {
    const untouched = {
      ...boundaryMatches,
      east: { ...boundaryMatches.east, matches: null },
    } as InspectorWorkspaceDraft["boundaryMatches"];
    const patch = deedVerdictPatch({ boundaryMatches: untouched }, "no");
    expect(patch.deedMatchesNature).toBe("no");
    expect(patch.boundaryMatches.south.matches).toBe(false);
    expect(patch.boundaryMatches.south.mismatchNote).toBe("أقصر بمترين");
    expect(patch.boundaryMatches.east.matches).toBe(true);
  });
});

describe("deedVerdictHeadline", () => {
  const untouched = {
    north: { ...boundaryMatches.north, matches: null },
    south: { ...boundaryMatches.south, matches: null },
    east: { ...boundaryMatches.east, matches: null },
    west: { ...boundaryMatches.west, matches: null },
  } as InspectorWorkspaceDraft["boundaryMatches"];

  it("prints the inspector's verdict, or «لم يحدد» when nothing explicit exists", () => {
    expect(deedVerdictHeadline({ deedMatchesNature: "yes", boundaryMatches })).toBe("المعاين: مطابق");
    expect(deedVerdictHeadline({ deedMatchesNature: "no", boundaryMatches })).toBe("المعاين: غير مطابق");
    expect(deedVerdictHeadline({ deedMatchesNature: "", boundaryMatches: untouched })).toBe("المعاين: لم يحدد");
  });
});
