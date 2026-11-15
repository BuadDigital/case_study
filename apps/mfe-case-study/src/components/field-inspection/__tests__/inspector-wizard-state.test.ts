import { describe, expect, it } from "vitest";
import {
  COMPONENT_BOOL_KEYS,
  INSPECTOR_ANNEX_COUNT_FIELDS,
  INSPECTOR_COMPONENT_COUNT_FIELDS,
  INSPECTOR_FRAME_SECTIONS,
  annexAnswerPatch,
  firstInspectorStepToComplete,
  inspectorComponentCountFields,
  inspectorFrameStep,
  inspectorSectionId,
  listComponentBoolPhotoSlots,
} from "../inspector-wizard-state";
import {
  INSPECTOR_FEATURE_FIELDS,
  isShopHiddenInspectorComponentKey,
  visibleInspectorFeatureFields,
  type InspectorFeatureField,
} from "@platform/app-shared/app-data/inspector-workspace-data";

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

  it("never offers a picker for a field with no photo on «نعم»", () => {
    const noPhotoFields: InspectorFeatureField[] = fields.map((f) =>
      f.key === "hasPool" ? { ...f, photoOnYes: false, optionalPhoto: false } : f,
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

/** 2026-11-04: phone and desktop render one count list, so a count can no longer be phone-only. */
describe("inspectorComponentCountFields — one list for phone and desktop", () => {
  it("offers every count the phone had, the desktop's missing seven included", () => {
    const keys = inspectorComponentCountFields(false).map((f) => f.key);
    for (const key of [
      "jacuzziCount",
      "diningCount",
      "majlisCount",
      "maidRoomCount",
      "guardRoomCount",
      "storeCount",
      "playgroundCount",
      "parkingCount",
      "showroomCount",
      "wellCount",
    ] as const) {
      expect(keys).toContain(key);
    }
    expect(keys).toEqual(INSPECTOR_COMPONENT_COUNT_FIELDS.map((f) => f.key));
  });

  it("asks a proof photo for the showroom and the well only", () => {
    const withPhoto = INSPECTOR_COMPONENT_COUNT_FIELDS.filter((f) => f.photo).map((f) => [
      f.key,
      f.photo!.key,
    ]);
    expect(withPhoto).toEqual([
      ["showroomCount", "showroom"],
      ["wellCount", "well"],
    ]);
  });

  it("hides the counts a commercial shop does not record, like the phone", () => {
    const keys = inspectorComponentCountFields(true).map((f) => f.key);
    for (const key of keys) expect(isShopHiddenInspectorComponentKey(key)).toBe(false);
    expect(keys).toEqual(
      expect.arrayContaining(["bathroomCount", "showroomCount", "parkingCount", "storeCount"]),
    );
    expect(keys).not.toContain("jacuzziCount");
    expect(keys).not.toContain("roomCount");
    expect(isShopHiddenInspectorComponentKey("hasAnnex")).toBe(true);
  });
});

describe("annexAnswerPatch — annex counts are numbers on both devices", () => {
  it("keeps the counts on «نعم» and empties them on «لا»", () => {
    expect(annexAnswerPatch("نعم")).toEqual({ hasAnnex: "نعم" });
    expect(annexAnswerPatch("لا")).toEqual({
      hasAnnex: "لا",
      annexUpperCount: "",
      annexGroundCount: "",
    });
  });

  it("labels both annex counts as counts", () => {
    expect(INSPECTOR_ANNEX_COUNT_FIELDS.map((f) => f.key)).toEqual([
      "annexUpperCount",
      "annexGroundCount",
    ]);
    expect(INSPECTOR_ANNEX_COUNT_FIELDS.every((f) => f.label.includes("(عدد)"))).toBe(true);
  });
});

describe("the inspector's page on the work page's frame", () => {
  it("has one numbered section per wizard step, in step order", () => {
    expect(INSPECTOR_FRAME_SECTIONS.map((s) => [s.id, s.step])).toEqual([
      ["ins-step-1", 1],
      ["ins-step-2", 2],
      ["ins-step-3", 3],
    ]);
    expect(INSPECTOR_FRAME_SECTIONS.map((s) => s.title)).toEqual([
      "الموقع والتصوير",
      "بيانات العقار",
      "التجهيز والإكمال",
    ]);
    expect(inspectorSectionId(2)).toBe("ins-step-2");
  });

  it("opens at the first step with a required field missing", () => {
    expect(firstInspectorStepToComplete(() => true)).toBe(1);
    expect(firstInspectorStepToComplete((step) => step === 2)).toBe(2);
    expect(firstInspectorStepToComplete((step) => step === 3)).toBe(3);
    // A later gap does not hide an earlier one.
    expect(firstInspectorStepToComplete((step) => step !== 2)).toBe(1);
  });

  it("opens at the last step, where the inspection is sent, when nothing is missing", () => {
    expect(firstInspectorStepToComplete(() => false)).toBe(3);
  });

  it("puts a sent inspection past every section, so all three read done", () => {
    expect(inspectorFrameStep(2, false)).toBe(2);
    const sent = inspectorFrameStep(1, true);
    expect(INSPECTOR_FRAME_SECTIONS.every((s) => s.step < sent)).toBe(true);
  });
});
