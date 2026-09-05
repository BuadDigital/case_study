import { describe, expect, it } from "vitest";
import {
  serviceAmenityPhotoSlotId,
  type InspectorSlotPhoto,
} from "../../../lib/app-data/inspector-workspace-data";
import {
  DEFINED_PHOTOS_EMPTY_TEXT,
  definedPhotosIntroText,
  definedSlotNone,
  definedSlotReplacedBy,
  definedSlotWithApproved,
  definedSlotWithoutPhoto,
  definedSlotWithPhoto,
  emptyDefinedPhotoSlot,
  findDefinedSlotPhoto,
  freePhotoRef,
  listDefinedPhotoSlotCells,
  setDefinedPhotoSlot,
  slotPhotoRef,
  transactionPickerLabel,
} from "../inspector-wizard-state";

const photo = (id: number, approved = true): InspectorSlotPhoto => ({
  id,
  approved,
  fileName: `p${id}.jpg`,
  mimeType: "image/jpeg",
  attachmentId: `att-${id}`,
});

const electricity = serviceAmenityPhotoSlotId("service", "كهرباء");
const schools = serviceAmenityPhotoSlotId("amenity", "مدارس");

describe("photo cache refs", () => {
  it("keys slot photos by slot and id, free photos by id", () => {
    expect(slotPhotoRef(electricity, 4)).toBe(`slot:${electricity}:4`);
    expect(freePhotoRef(2)).toBe("free:2");
  });
});

describe("listDefinedPhotoSlotCells", () => {
  it("emits one cell per selected service then amenity, skipping blank labels", () => {
    const cells = listDefinedPhotoSlotCells({
      services: ["كهرباء", "  "],
      amenities: ["مدارس"],
      definedPhotos: {},
    });
    expect(cells.map((c) => c.id)).toEqual([electricity, schools]);
    expect(cells[0]).toMatchObject({
      kind: "service",
      label: "كهرباء",
      slot: { none: false, photos: [] },
      done: false,
      first: undefined,
      photoRef: undefined,
    });
  });

  it("joins the slot state: approved photo or «غير متوفر» counts as done, an unapproved one does not", () => {
    const cells = listDefinedPhotoSlotCells({
      services: ["كهرباء", "ماء"],
      amenities: ["مدارس"],
      definedPhotos: {
        [electricity]: { none: false, photos: [photo(7), photo(8)] },
        [serviceAmenityPhotoSlotId("service", "ماء")]: { none: true, photos: [] },
        [schools]: { none: false, photos: [photo(9, false)] },
      },
    });
    expect(cells[0]).toMatchObject({ done: true, first: photo(7), photoRef: slotPhotoRef(electricity, 7) });
    expect(cells[1]).toMatchObject({ done: true, first: undefined, photoRef: undefined });
    expect(cells[2]).toMatchObject({ done: false, first: photo(9, false) });
  });
});

describe("labels", () => {
  it("explains the transaction picker only when it is available", () => {
    expect(definedPhotosIntroText("desktop", true)).toContain("مرفقات المعاملة");
    expect(definedPhotosIntroText("desktop", false)).not.toContain("مرفقات المعاملة");
    expect(definedPhotosIntroText("mobile", true)).toContain("مرفقات المعاملة");
    expect(definedPhotosIntroText("mobile", false)).toContain("اضغط الخانة");
    expect(DEFINED_PHOTOS_EMPTY_TEXT).toContain("الخدمات والمرافق المحيطة");
    expect(transactionPickerLabel(false)).toBe("من صور المعاملة");
    expect(transactionPickerLabel(true)).toBe("تغيير من المعاملة");
  });
});

describe("slot updates", () => {
  const slot = { none: false, photos: [photo(1), photo(2, false)] };

  it("appends, removes, approves and replaces without mutating the input", () => {
    expect(definedSlotWithPhoto({ none: true, photos: [] }, photo(3))).toEqual({ none: false, photos: [photo(3)] });
    expect(definedSlotWithoutPhoto(slot, 1)).toEqual({ none: false, photos: [photo(2, false)] });
    expect(definedSlotWithApproved(slot, 2)).toEqual({ none: false, photos: [photo(1), photo(2)] });
    expect(definedSlotReplacedBy(photo(5))).toEqual({ none: false, photos: [photo(5)] });
    expect(slot.photos).toHaveLength(2);
    expect(slot.photos[1]!.approved).toBe(false);
  });

  it("«غير متوفر» drops the photos either way", () => {
    expect(definedSlotNone(true)).toEqual({ none: true, photos: [] });
    expect(definedSlotNone(false)).toEqual(emptyDefinedPhotoSlot());
  });

  it("writes one slot into the map and finds a photo by slot and id", () => {
    const definedPhotos = { [electricity]: slot };
    const next = setDefinedPhotoSlot(definedPhotos, schools, definedSlotNone(true));
    expect(next).toEqual({ [electricity]: slot, [schools]: { none: true, photos: [] } });
    expect(definedPhotos).toEqual({ [electricity]: slot });
    expect(findDefinedSlotPhoto(next, electricity, 2)).toEqual(photo(2, false));
    expect(findDefinedSlotPhoto(next, schools, 2)).toBeUndefined();
    expect(findDefinedSlotPhoto(next, "missing", 2)).toBeUndefined();
  });
});
