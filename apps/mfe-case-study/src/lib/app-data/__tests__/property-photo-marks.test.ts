import { describe, expect, it } from "vitest";
import {
  EMPTY_PROPERTY_PHOTO_MARKS,
  orderPropertyPhotos,
  pickInspectorPrimaryPhoto,
  reportPhotoIds,
  togglePropertyPhotoMark,
  type PropertyDetailDocumentEntry,
  type PropertyPhotoMarks,
} from "@platform/app-shared/app-data/property-detail-document-types";

const photo = (id: string, name: string): PropertyDetailDocumentEntry => ({
  id,
  name,
  fileName: `${id}.jpg`,
  source: "المعاين الميداني",
  kind: "image",
  attachmentId: id,
  documentTypeKey: "inspection-photo",
});

const meter = photo("meter", "خدمة: كهرباء");
const water = photo("water", "خدمة: ماء");
const road = photo("road", "خدمة: سفلتة");
const school = photo("school", "مرفق: مدرسة");
const facade = photo("facade", "واجهة");
const outside = photo("outside", "صور خارجية");
const inside = photo("inside", "صور داخلية");
const other = photo("other", "أخرى");
const proof = photo("proof", "صورة توثيقية — المطبخ");

const marks = (over: Partial<PropertyPhotoMarks>): PropertyPhotoMarks => ({
  ...EMPTY_PROPERTY_PHOTO_MARKS,
  ...over,
});

const ids = (photos: PropertyDetailDocumentEntry[]) => photos.map((p) => p.id);

describe("the automatic order of the property's photos", () => {
  it("leads with the property, then the meters, then the rest", () => {
    expect(ids(orderPropertyPhotos([road, water, meter, other, inside, outside, facade]))).toEqual([
      "facade",
      "outside",
      "inside",
      "meter",
      "water",
      "other",
      "road",
    ]);
  });

  it("keeps the taken order inside one rank", () => {
    const second = photo("second", "صور خارجية");
    expect(ids(orderPropertyPhotos([outside, second]))).toEqual(["outside", "second"]);
  });

  it("follows a mark over the photo's name", () => {
    const ordered = orderPropertyPhotos(
      [facade, outside],
      marks({ main: "outside", electricity: ["facade"] }),
    );
    expect(ids(ordered)).toEqual(["outside", "facade"]);
  });
});

describe("the property's main photo", () => {
  it("never opens on the electricity meter when anything else exists", () => {
    expect(pickInspectorPrimaryPhoto([meter, outside])?.id).toBe("outside");
    expect(pickInspectorPrimaryPhoto([meter, inside])?.id).toBe("inside");
    expect(pickInspectorPrimaryPhoto([meter, water, other])?.id).toBe("other");
  });

  it("prefers the facade, and takes an apartment's interior without one", () => {
    expect(pickInspectorPrimaryPhoto([outside, facade])?.id).toBe("facade");
    expect(pickInspectorPrimaryPhoto([meter, inside, proof])?.id).toBe("inside");
  });

  it("takes the marked photo, even a service photo", () => {
    expect(pickInspectorPrimaryPhoto([facade, road], marks({ main: "road" }))?.id).toBe("road");
  });

  it("falls back when the marked photo was retaken", () => {
    expect(pickInspectorPrimaryPhoto([meter, outside], marks({ main: "gone" }))?.id).toBe("outside");
  });

  it("takes a service photo only when nothing else exists", () => {
    expect(pickInspectorPrimaryPhoto([school, meter])?.id).toBe("meter");
    expect(pickInspectorPrimaryPhoto([])).toBeNull();
  });
});

describe("pressing a photo's icon", () => {
  const empty = EMPTY_PROPERTY_PHOTO_MARKS;

  it("keeps one main photo", () => {
    const next = togglePropertyPhotoMark(marks({ main: "a" }), "b", "main");
    expect(next.main).toBe("b");
  });

  it("clears a held mark on the second press", () => {
    const once = togglePropertyPhotoMark(empty, "a", "main");
    expect(togglePropertyPhotoMark(once, "a", "main").main).toBeNull();
    const meterOnce = togglePropertyPhotoMark(empty, "a", "water");
    expect(togglePropertyPhotoMark(meterOnce, "a", "water").water).toEqual([]);
  });

  it("lets several photos be meters", () => {
    const next = togglePropertyPhotoMark(marks({ electricity: ["a"] }), "b", "electricity");
    expect(next.electricity).toEqual(["a", "b"]);
  });

  it("gives a photo one role, and keeps it in the report", () => {
    const next = togglePropertyPhotoMark(
      marks({ main: "a", electricity: ["b"], report: ["a"] }),
      "a",
      "water",
    );
    expect(next).toEqual({ main: null, electricity: ["b"], water: ["a"], report: ["a"] });
  });

  it("leaves the role alone when the report changes", () => {
    const next = togglePropertyPhotoMark(marks({ main: "a" }), "a", "report");
    expect(next).toEqual(marks({ main: "a", report: ["a"] }));
  });
});

describe("the photos the report prints", () => {
  it("follows the automatic order, whatever order they were picked in", () => {
    expect(reportPhotoIds([meter, facade, inside], marks({ report: ["meter", "inside", "facade"] }))).toEqual([
      "facade",
      "inside",
      "meter",
    ]);
  });

  it("drops a photo no longer on the property, and is empty without a choice", () => {
    expect(reportPhotoIds([facade], marks({ report: ["gone", "facade"] }))).toEqual(["facade"]);
    expect(reportPhotoIds([facade], marks({}))).toEqual([]);
    expect(reportPhotoIds([facade], null)).toEqual([]);
  });
});
