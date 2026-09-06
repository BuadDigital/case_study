import { describe, expect, it } from "vitest";
import {
  boundaryDeedDisplay,
  boundaryMatchPatch,
  canPinInspectorMap,
  inspectionContextOf,
  inspectorErrorLinks,
  inspectorMapCoordsLabel,
  inspectorServiceMeters,
  newerInspectorDraft,
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
