import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";
import { withMapLinkStartingPoint } from "../inspector-deed-prefill";
import { emptyProperty } from "../po-intake-data";

function draft(patch: Partial<ReturnType<typeof createInspectorWorkspaceDraft>> = {}) {
  return {
    ...createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "PO" }),
    ...patch,
  };
}

const riyadhLink = { ...emptyProperty(), locationMapUrl: "https://maps.google.com/?q=24.8312,46.6421" };

describe("the inspector's map starts at the initial data's map link", () => {
  it("replaces the Jeddah placeholder of an unpinned draft", () => {
    const next = withMapLinkStartingPoint(
      draft({ mapLatitude: "21.481000", mapLongitude: "39.186500", mapPinned: false }),
      riyadhLink,
    );
    expect([next.mapLatitude, next.mapLongitude]).toEqual(["24.831200", "46.642100"]);
    expect(next.mapPinned).toBe(false);
  });

  it("leaves a pinned or moved location, an unusable link and a point abroad alone", () => {
    const pinned = draft({ mapLatitude: "21.481000", mapLongitude: "39.186500", mapPinned: true });
    expect(withMapLinkStartingPoint(pinned, riyadhLink)).toBe(pinned);

    const moved = draft({ mapLatitude: "24.700000", mapLongitude: "46.700000", mapPinned: false });
    expect(withMapLinkStartingPoint(moved, riyadhLink)).toBe(moved);

    const placeholder = draft({ mapLatitude: "21.481000", mapLongitude: "39.186500" });
    expect(
      withMapLinkStartingPoint(placeholder, { ...emptyProperty(), locationMapUrl: "not a link at all" }),
    ).toBe(placeholder);
    expect(
      withMapLinkStartingPoint(placeholder, {
        ...emptyProperty(),
        locationMapUrl: "https://maps.google.com/?q=51.5074,-0.1278",
      }),
    ).toBe(placeholder);
  });
});
