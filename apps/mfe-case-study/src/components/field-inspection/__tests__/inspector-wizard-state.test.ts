import { describe, expect, it } from "vitest";
import {
  COMPONENT_BOOL_KEYS,
  listComponentBoolPhotoSlots,
} from "../inspector-wizard-state";
import {
  INSPECTOR_FEATURE_FIELDS,
  visibleInspectorFeatureFields,
  type InspectorFeatureField,
} from "../../../lib/app-data/inspector-workspace-data";

const fields = visibleInspectorFeatureFields(false);

function draft(
  featureValues: Record<string, string>,
  attached: string[] = [],
) {
  return {
    featureValues,
    featurePhotoAttachments: Object.fromEntries(
      attached.map((key) => [
        key,
        { fileName: `${key}.jpg`, mimeType: "image/jpeg", attachmentId: `att-${key}` },
      ]),
    ),
  };
}

describe("listComponentBoolPhotoSlots", () => {
  it("renders one pill per component key, in card order, all off on an empty draft", () => {
    const slots = listComponentBoolPhotoSlots(draft({}), fields);
    expect(slots.map((s) => s.key)).toEqual([...COMPONENT_BOOL_KEYS]);
    expect(slots.every((s) => !s.on && !s.needsPhoto && !s.hasPhoto)).toBe(true);
    expect(slots.map((s) => s.label)).toEqual(
      COMPONENT_BOOL_KEYS.map(
        (key) => INSPECTOR_FEATURE_FIELDS.find((f) => f.key === key)!.label,
      ),
    );
  });

  it("asks for a picker exactly on the pills answered «نعم» — the photo rule mirrors the UI", () => {
    const slots = listComponentBoolPhotoSlots(
      draft({ hasPool: "نعم", hasElevator: "لا", kitchen: "نعم" }),
      fields,
    );
    const byKey = Object.fromEntries(slots.map((s) => [s.key, s]));
    expect(byKey.hasPool).toMatchObject({ on: true, needsPhoto: true, hasPhoto: false });
    expect(byKey.kitchen).toMatchObject({ on: true, needsPhoto: true, hasPhoto: false });
    expect(byKey.hasElevator).toMatchObject({ on: false, needsPhoto: false });
    expect(byKey.carEntrance).toMatchObject({ on: false, needsPhoto: false });
  });

  it("counts a slot satisfied only once an attachment id exists", () => {
    const withId = listComponentBoolPhotoSlots(
      draft({ hasBasement: "نعم" }, ["hasBasement"]),
      fields,
    ).find((s) => s.key === "hasBasement")!;
    expect(withId).toMatchObject({ needsPhoto: true, hasPhoto: true });

    const pendingUpload = listComponentBoolPhotoSlots(
      {
        featureValues: { hasBasement: "نعم" },
        featurePhotoAttachments: {
          hasBasement: { fileName: "x.jpg", mimeType: "image/jpeg" },
        },
      },
      fields,
    ).find((s) => s.key === "hasBasement")!;
    expect(pendingUpload.hasPhoto).toBe(false);
  });

  it("never needs a picker for a field that does not require a photo on «نعم»", () => {
    const noPhotoFields: InspectorFeatureField[] = fields.map((f) =>
      f.key === "hasPool" ? { ...f, photoOnYes: false } : f,
    );
    const slot = listComponentBoolPhotoSlots(
      draft({ hasPool: "نعم" }),
      noPhotoFields,
    ).find((s) => s.key === "hasPool")!;
    expect(slot).toMatchObject({ on: true, needsPhoto: false });
  });

  it("skips keys hidden from the field list and renders nothing for land", () => {
    const withoutKitchen = fields.filter((f) => f.key !== "kitchen");
    expect(
      listComponentBoolPhotoSlots(draft({ kitchen: "نعم" }), withoutKitchen).map(
        (s) => s.key,
      ),
    ).not.toContain("kitchen");
    expect(listComponentBoolPhotoSlots(draft({ hasPool: "نعم" }), fields, true)).toEqual([]);
  });
});
