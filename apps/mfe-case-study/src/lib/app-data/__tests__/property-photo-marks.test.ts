import { describe, expect, it } from "vitest";
import {
  EMPTY_PROPERTY_PHOTO_MARKS,
  orderPropertyPhotos,
  orderReportPhotos,
  movablesBoardIds,
  pickInspectorPrimaryPhoto,
  placeOnReportBoard,
  reportPhotoIds,
  withMovablesBoard,
  withReportBoard,
  suggestedReportSection,
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
    expect(next).toEqual(marks({ electricity: ["b"], water: ["a"], report: ["a"] }));
  });

  it("makes a meter photo movables, never both", () => {
    const next = togglePropertyPhotoMark(marks({ water: ["a"] }), "a", "movables");
    expect(next).toEqual(marks({ movables: ["a"] }));
  });

  it("leaves the role alone when the report changes", () => {
    const next = togglePropertyPhotoMark(marks({ main: "a" }), "a", "report");
    expect(next).toEqual(marks({ main: "a", report: ["a"] }));
  });
});

describe("the report's sections", () => {
  const room = photo("room", "صور داخلية · مرفق");
  const kitchen = photo("kitchen", "صور داخلية · أخرى");
  const yard = photo("yard", "صور خارجية · خدمة");

  it("suggests exterior, interior or other from the inspector's category", () => {
    expect(suggestedReportSection(facade)).toBe(1);
    expect(suggestedReportSection(outside)).toBe(1);
    expect(suggestedReportSection(inside)).toBe(2);
    expect(suggestedReportSection(room)).toBe(2);
    expect(suggestedReportSection(kitchen)).toBe(2);
    expect(suggestedReportSection(yard)).toBe(3);
    expect(suggestedReportSection(school)).toBe(3);
    expect(suggestedReportSection(meter)).toBe(3);
    expect(suggestedReportSection(proof)).toBe(3);
    expect(suggestedReportSection(other)).toBe(3);
  });

  it("prints exterior, then interior, then other, the main photo first", () => {
    expect(ids(orderReportPhotos([meter, yard, inside, outside, facade], null))).toEqual([
      "facade",
      "outside",
      "inside",
      "yard",
      "meter",
    ]);
  });

  it("follows the specialist's section over the suggestion", () => {
    const picked = marks({ report: ["yard"], reportSections: { yard: 2 } });
    expect(ids(orderReportPhotos([yard, inside, outside], picked))).toEqual([
      "outside",
      "yard",
      "inside",
    ]);
  });
});

describe("the photos the report prints", () => {
  it("prints picks saved before the board sorted by section, the marked main photo first", () => {
    expect(
      reportPhotoIds([meter, facade, inside], marks({ main: "facade", report: ["meter", "inside"] })),
    ).toEqual(["facade", "inside", "meter"]);
  });

  it("adds nothing by itself: no automatic main photo, no meters", () => {
    expect(
      reportPhotoIds([meter, water, facade, inside], marks({ electricity: ["meter"], report: ["inside"] })),
    ).toEqual(["inside"]);
  });

  it("drops a photo no longer on the property, and is empty without a choice", () => {
    expect(reportPhotoIds([facade, inside], marks({ report: ["gone", "inside"] }))).toEqual(["inside"]);
    expect(reportPhotoIds([facade], marks({ report: ["gone"] }))).toEqual([]);
    expect(reportPhotoIds([facade], marks({}))).toEqual([]);
    expect(reportPhotoIds([facade], null)).toEqual([]);
  });
});

describe("the report board (2026-11-03)", () => {
  it("starts empty: the specialist always chooses", () => {
    expect(reportPhotoIds([meter, facade, inside], null)).toEqual([]);
  });

  it("prints a saved board in its own order", () => {
    const board = withReportBoard(EMPTY_PROPERTY_PHOTO_MARKS, ["inside", "facade"]);
    expect(reportPhotoIds([meter, facade, outside, inside], board)).toEqual(["inside", "facade"]);
  });

  it("makes slot 1 the main photo, which leaves an old meter mark", () => {
    const saved = withReportBoard(marks({ main: "facade", electricity: ["inside"] }), ["inside", "facade"]);
    expect(saved).toMatchObject({ main: "inside", electricity: [], report: ["inside", "facade"], reportOrdered: true });
    expect(pickInspectorPrimaryPhoto([facade, inside], saved)?.id).toBe("inside");
    expect(withReportBoard(saved, []).main).toBeNull();
  });

  it("swaps two slots, and moves a slot dropped on an empty one to the end", () => {
    expect(placeOnReportBoard(["a", "b", "c"], { slot: 0 }, 2, 24)).toEqual(["c", "b", "a"]);
    expect(placeOnReportBoard(["a", "b", "c"], { slot: 0 }, 7, 24)).toEqual(["b", "c", "a"]);
    expect(placeOnReportBoard(["a", "b"], { photoId: "b" }, 0, 24)).toEqual(["b", "a"]);
  });

  it("replaces a photo with a new one, or fills the next free slot, up to the limit", () => {
    expect(placeOnReportBoard(["a", "b"], { photoId: "x" }, 0, 24)).toEqual(["x", "b"]);
    expect(placeOnReportBoard(["a", "b"], { photoId: "x" }, 5, 24)).toEqual(["a", "b", "x"]);
    expect(placeOnReportBoard(["a", "b"], { photoId: "x" }, 2, 2)).toEqual({
      refused: "التقرير يطبع 2 صورة كحد أقصى",
    });
  });

  it("drops the sections, which are no longer chosen", () => {
    const saved = withReportBoard(marks({ reportSections: { a: 2 }, movables: ["a", "m"] }), ["a", "b"]);
    expect(saved).toMatchObject({ reportSections: {}, movables: ["m"] });
  });
});

describe("the movables board (2026-11-03)", () => {
  const sofa = photo("sofa", "صورة توثيقية — منقولات");
  const chair = photo("chair", "منقولات: كرسي");

  it("starts empty and follows the specialist's choice", () => {
    expect(movablesBoardIds([facade, sofa, chair], null)).toEqual([]);
    expect(movablesBoardIds([facade, sofa, chair], marks({ movables: ["chair", "gone", "sofa"] }))).toEqual([
      "chair",
      "sofa",
    ]);
  });

  it("takes a photo off the report board, slot 1 passing to the next photo", () => {
    const board = withReportBoard(EMPTY_PROPERTY_PHOTO_MARKS, ["facade", "inside"]);
    const next = withMovablesBoard(board, ["facade"]);
    expect(next).toMatchObject({ main: "inside", movables: ["facade"], report: ["inside"] });
  });

  it("turning a photo into movables takes it off the report board", () => {
    const next = togglePropertyPhotoMark(marks({ report: ["inside", "outside"] }), "inside", "movables");
    expect(next.report).toEqual(["outside"]);
    expect(next.movables).toEqual(["inside"]);
  });
});
