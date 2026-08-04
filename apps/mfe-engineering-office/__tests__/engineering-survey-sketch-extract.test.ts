import { describe, expect, it } from "vitest";
import {
  fillMissingLengthsFromTableContext,
  parseBoundaryBlock,
  parseLengthsFromPositions,
  parseSurveySketchText,
  sketchExtractToEmptyFieldsPatch,
  sketchNatureFieldsFromExtract,
  sketchNatureFieldsFromDeedForm,
} from "../src/lib/engineering-survey-sketch-extract";

/** Matches the croquis table layout from the user's PDF. */
const croquisTablesText = `
بموجب الطبيعة لكامل الموقع
الحد وصف الحد الطول/م
شمال قطعة رقم 225 24.25
جنوب قطعة رقم 229 24.50
شرق شارع عرض 15 م 25.00
غرب قطعة رقم 226 24.95
المساحه 606.49 م2

بموجب الصك لكامل الموقع
الحد وصف الحد الطول/م
شمال قطعة رقم 225 24.25
جنوب قطعة رقم 229 24.50
شرق شارع عرض 15 م 25.00
غرب قطعة رقم 226 24.95
المساحه 609.00 م2
المساحه 606.49 م2 حسابيا
`;

const sampleDeedNature = `
الحدود والأطوال حسب الصك
المساحة الإجمالية: 625.50 م2
الحد الشمالي: شارع عرض 15 متر طول 25.00 م
الحد الجنوبي: أملاك عبد الله طول 25.00 م
الحد الشرقي: قطعة رقم 12 طول 24.50 م
الحد الغربي: قطعة رقم 10 طول 24.50 م

الحدود والأطوال حسب الطبيعة
المساحة الإجمالية: 620.00 م2
الحد الشمالي: شارع عرض 15 متر طول 24.95 م
الحد الجنوبي: أملاك عبد الله طول 24.95 م
الحد الشرقي: قطعة رقم 12 طول 24.25 م
الحد الغربي: قطعة رقم 10 طول 24.25 م
`;

const croquisLengthOnlyItems = [
  { str: "24.25", x: 661.2, y: 677.88, a: 10.39, b: -12.426, width: 40.75 },
  { str: "24.25", x: 645.84, y: 665.03, a: 10.39, b: -12.426, width: 40.75 },
  { str: "25.00", x: 666.0, y: 524.64, a: -13.348, b: -9.173, width: 40.75 },
  { str: "25.00", x: 653.63, y: 542.52, a: -13.348, b: -9.173, width: 40.75 },
  { str: "24.50", x: 455.52, y: 541.21, a: 10.347, b: -12.463, width: 40.75 },
  { str: "24.50", x: 471.96, y: 554.88, a: 10.347, b: -12.463, width: 40.75 },
  { str: "24.95", x: 510.48, y: 705.24, a: -13.348, b: -9.173, width: 40.75 },
  { str: "24.95", x: 521.15, y: 689.64, a: -13.348, b: -9.173, width: 40.75 },
];

describe("وصف الحد + أطوال from PDF", () => {
  it("extracts descriptions and lengths; never total area", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.hasData).toBe(true);
    expect(r.deed.north.description).toMatch(/قطعة رقم 225/);
    expect(r.deed.south.description).toMatch(/قطعة رقم 229/);
    expect(r.deed.east.description).toMatch(/شارع عرض 15/);
    expect(r.deed.west.description).toMatch(/قطعة رقم 226/);
    expect(r.deed.north.lengthM).toBe("24.25");
    expect(r.deed.south.lengthM).toBe("24.50");
    expect(r.deed.east.lengthM).toBe("25.00");
    expect(r.deed.west.lengthM).toBe("24.95");
    expect(r.deed.areaSqm).toBe("");
  });

  it("keeps nature sides; ignores total area", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.nature).not.toBeNull();
    expect(r.deedMatchesNature).toBe("yes");
    expect(r.nature!.areaSqm).toBe("");
    expect(r.nature!.north.description).toMatch(/225/);
    expect(r.nature!.north.lengthM).toBe("24.25");
  });

  it("patches form northBoundary etc. from croquis", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {}, true);
    expect(patch.northBoundary).toMatch(/قطعة رقم 225/);
    expect(patch.southBoundary).toMatch(/قطعة رقم 229/);
    expect(patch.eastBoundary).toMatch(/شارع/);
    expect(patch.westBoundary).toMatch(/قطعة رقم 226/);
    expect(patch.northBoundaryLengthM).toBe("24.25");
    expect(patch.natureNorthBoundary).toMatch(/225/);
    expect(patch.natureNorthBoundaryLengthM).toBe("24.25");
  });

  it("reads lengths from under الطول/م header", () => {
    const r = parseSurveySketchText(`
24.95 25.00 24.25 24.50
شمال 24.95 جنوب 25.00 شرق 24.25 غرب 24.50
بموجب الصك
الحد وصف الحد الطول/م
شمال قطعة رقم 225 24.25
جنوب قطعة رقم 229 24.50
شرق شارع عرض 15 م 25.00
غرب قطعة رقم 226 24.95
المساحه 609 م2
`);
    expect(r.deed.north.lengthM).toBe("24.25");
    expect(r.deed.north.description).toMatch(/225/);
  });

  it("zips length-column decimals onto rows with descriptions", () => {
    const partial = parseBoundaryBlock(`
      الطول/م
      شمال قطعة رقم 225
      جنوب قطعة رقم 229
      شرق شارع عرض 15 م
      غرب قطعة رقم 226
      24.25 24.50 25.00 24.95
    `);
    expect(partial.north.description).toMatch(/225/);
    expect(partial.north.lengthM).toBe("24.25");
    expect(partial.west.lengthM).toBe("24.95");
  });

  it("fills lengths next to table rows", () => {
    const partial = parseBoundaryBlock(`
      شمال قطعة رقم 225
      جنوب قطعة رقم 229
      شرق شارع عرض 15 م
      غرب قطعة رقم 226
    `);
    const filled = fillMissingLengthsFromTableContext(
      partial,
      `
        شمال قطعة رقم 225 24.25
        جنوب قطعة رقم 229 24.50
        شرق شارع عرض 15 م 25.00
        غرب قطعة رقم 226 24.95
      `,
      true,
    );
    expect(filled.north.description).toMatch(/225/);
    expect(filled.north.lengthM).toBe("24.25");
  });

  it("nature fields include descriptions", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const n = sketchNatureFieldsFromExtract(r);
    expect(n.natureNorthBoundary).toMatch(/225/);
    expect(n.natureNorthBoundaryLengthM).toBe("24.25");
  });

  it("deed form seed copies text + lengths", () => {
    const n = sketchNatureFieldsFromDeedForm({
      northBoundary: "قطعة رقم 1",
      northBoundaryLengthM: "20.00",
    });
    expect(n.natureNorthBoundary).toBe("قطعة رقم 1");
    expect(n.natureNorthBoundaryLengthM).toBe("20.00");
  });

  it("labeled prose: different nature lengths + descriptions", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    expect(r.deed.north.lengthM).toBe("25.00");
    expect(r.deed.north.description).toMatch(/شارع/);
    expect(r.nature!.north.lengthM).toBe("24.95");
    expect(r.deedMatchesNature).toBe("no");
    expect(r.deed.areaSqm).toBe("");
  });

  it("does not invent N/S/E/W from a bare number list", () => {
    const r = parseSurveySketchText(
      "24.25 24.25 25.00 25.00 24.50 24.50 24.95 24.95",
    );
    expect(r.hasData).toBe(false);
  });

  it("does not overwrite filled fields; never patches area", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {
      northBoundary: "موجود",
      northBoundaryLengthM: "",
    });
    expect(patch.northBoundary).toBeUndefined();
    expect(patch.northBoundaryLengthM).toBe("25.00");
  });

  it("overwrites on re-upload", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(
      r,
      {
        northBoundary: "قديم",
        northBoundaryLengthM: "24.95",
      },
      true,
    );
    expect(patch.northBoundary).toMatch(/225/);
    expect(patch.northBoundaryLengthM).toBe("24.25");
  });

  it("formats plot ids with letter suffix (94-س)", () => {
    const r = parseSurveySketchText(`
      بموجب الصك
      شمال قطعة رقم 94-س 25.00
      جنوب قطعة رقم 90-س 25.00
      شرق شارع عرض 20 م 20.00
      غرب قطعة رقم 91-س 20.00
    `);
    expect(r.deed.north.description).toBe("قطعة رقم 94-س");
    expect(r.deed.south.description).toBe("قطعة رقم 90-س");
    expect(r.deed.east.description).toMatch(/شارع عرض 20/);
    expect(r.deed.west.description).toBe("قطعة رقم 91-س");
    expect(r.deed.north.lengthM).toBe("25.00");
    expect(r.deed.east.lengthM).toBe("20.00");
  });

  it("repairs OCR soup tokens (سرق → شرق, دقم → رقم)", () => {
    const r = parseSurveySketchText(`
      شمال قطعة رقم 94-س 25
      جنوب قطعة دقم 90-س 25
      سرق شارع عرض 20 م 20
      غرب قطعة رقه 91-س 20
    `);
    expect(r.deed.east.description).toMatch(/شارع/);
    expect(r.deed.south.description).toMatch(/90/);
    expect(r.deed.west.description).toMatch(/91/);
  });
});
describe("spatial edge lengths from croquis drawing numbers", () => {
  it("assigns N/S/E/W from rotated edge labels (960607 layout)", () => {
    const r = parseLengthsFromPositions(croquisLengthOnlyItems);
    expect(r).not.toBeNull();
    expect(r!.deed.north.lengthM).toBe("24.25");
    expect(r!.deed.south.lengthM).toBe("24.50");
    expect(r!.deed.east.lengthM).toBe("25.00");
    expect(r!.deed.west.lengthM).toBe("24.95");
  });

  it("ignores tiny chamfer outliers like 4.20m among full sides", () => {
    const items = [
      { str: "22.00", x: 664.1, y: 533.5, a: -7.38, b: -12.23, width: 35.64 },
      { str: "21.50", x: 617, y: 702.1, a: 12.07, b: -7.63, width: 35.63 },
      { str: "25.00", x: 464.3, y: 660.4, a: -7.63, b: -12.07, width: 35.63 },
      { str: "19.00", x: 472.6, y: 468.2, a: 12.07, b: -7.63, width: 35.63 },
      { str: "25.00", x: 645.2, y: 544.9, a: -7.38, b: -12.23, width: 35.64 },
      { str: "21.50", x: 605.6, y: 684, a: 12.07, b: -7.63, width: 35.63 },
      { str: "25.00", x: 483, y: 648.6, a: -7.63, b: -12.07, width: 35.63 },
      { str: "22.00", x: 485.2, y: 487.2, a: 12.07, b: -7.63, width: 35.63 },
      { str: "4.20", x: 597.4, y: 422.9, a: -13.89, b: -3.28, width: 27.78 },
    ];
    const r = parseLengthsFromPositions(items);
    expect(r).not.toBeNull();
    expect(r!.deed.south.lengthM).not.toBe("4.20");
    expect(r!.deed.north.lengthM).toBe("21.50");
    expect(r!.deed.south.lengthM).toBe("19.00");
    expect(r!.deed.east.lengthM).toBe("22.00");
    expect(r!.deed.west.lengthM).toBe("25.00");
  });

  it("handles square plot where all four edges are 25.00", () => {
    const items = [
      { str: "25.00", x: 665, y: 640, a: 5.37, b: -13.23, width: 35.6 },
      { str: "25.00", x: 524, y: 709, a: -13.23, b: -5.37, width: 35.6 },
      { str: "25.00", x: 424, y: 542, a: 5.37, b: -13.23, width: 35.6 },
      { str: "25.00", x: 620, y: 475, a: -13.23, b: -5.37, width: 35.6 },
      { str: "25.00", x: 647, y: 633, a: 5.37, b: -13.23, width: 35.6 },
      { str: "25.00", x: 532, y: 690, a: -13.23, b: -5.37, width: 35.6 },
      { str: "25.00", x: 450, y: 553, a: 5.37, b: -13.23, width: 35.6 },
      { str: "25.00", x: 611, y: 495, a: -13.23, b: -5.37, width: 35.6 },
    ];
    const r = parseLengthsFromPositions(items);
    expect(r).not.toBeNull();
    expect(r!.deed.north.lengthM).toBe("25.00");
    expect(r!.deed.south.lengthM).toBe("25.00");
    expect(r!.deed.east.lengthM).toBe("25.00");
    expect(r!.deed.west.lengthM).toBe("25.00");
  });
});

describe("Arabic وصف الحد text mining (PDF text layer)", () => {
  it("mines dir+plot/street descriptions from clean Arabic", async () => {
    const { mineBoundaryDescriptionsFromOcr, isPlausibleBoundaryDescription } =
      await import("../src/lib/engineering-survey-sketch-extract");
    const b = mineBoundaryDescriptionsFromOcr(`
      بموجب الصك لكامل الموقع
      شمال قطعة رقم 94-س 25
      جنوب قطعة رقم 90-س 25
      شرق شارع عرض 20 م 20
      غرب قطعة رقم 91-س 20
    `);
    expect(b.north.description).toBe("قطعة رقم 94-س");
    expect(b.south.description).toBe("قطعة رقم 90-س");
    expect(b.east.description).toMatch(/شارع عرض 20/);
    expect(b.west.description).toBe("قطعة رقم 91-س");
    expect(isPlausibleBoundaryDescription(b.north.description)).toBe(true);
  });

  it("mines loose OCR soup (سرق, رقم 91-س)", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`
      شمال قطعة رقم 94-س
      جنوب رقم 90-س
      سرق شارع عرض 20 م
      غرب رقم 91-س
    `);
    expect(b.north.description).toMatch(/94/);
    expect(b.east.description).toMatch(/شارع/);
    expect(b.west.description).toMatch(/91/);
  });

  it("mines ordered 4-line table dump (no direction labels)", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`بموجب الصك
قطعة رقم ٩٤- س
قطعة رقم ٩٠ - س
شارع عرض ٢٠ م
قطعة رقم ٩١ - س
٥٠٠ م٢
٢٥
٢٥
٢٠
٢٠`);
    expect(b.north.description).toBe("قطعة رقم 94-س");
    expect(b.south.description).toBe("قطعة رقم 90-س");
    expect(b.east.description).toMatch(/شارع عرض 20/);
    expect(b.west.description).toBe("قطعة رقم 91-س");
  });

  it("mines ordered 4 plot/street rows without -س suffix", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`بموجب الصك
قطعة رقم ٢٢٥
قطعة رقم ٢٢٩
شارع عرض ١٥ م
قطعة رقم ٢٣٦
`);
    expect(b.north.description).toBe("قطعة رقم 225");
    expect(b.south.description).toBe("قطعة رقم 229");
    expect(b.east.description).toMatch(/شارع عرض 15/);
    expect(b.west.description).toBe("قطعة رقم 236");
  });

  it("mines ممر مشاة as boundary description", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`
      شمال قطعة رقم 447
      جنوب ممر مشاة عرض 10 م
      شرق قطعة رقم 450
      غرب شارع عرض 30 م
    `);
    expect(b.south.description).toMatch(/ممر مشاة عرض 10/);
  });

  it("mines sakka / land / owner table rows (training hard cases)", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`
٢٧,٣٠
ارض فضاد المنسوبة لبكر برناوى
٢٦,٥٠
سكة نافذة عرضها مما يلى الشرق ٦٠,مم
١٧,٥٠
سكة نافذة عرضعا مما يلى الشمال ١٣,٥٠م
١٨,٤٠
الجزء المفرز الخاص بمحمد نظمى
`);
    expect(b.north.description).toMatch(/ارض/);
    expect(b.south.description).toBe("سكة نافذة");
    expect(b.east.description).toBe("سكة نافذة");
    expect(b.west.description).toMatch(/جزء/);
    expect(b.north.lengthM).toBe("27.3");
    expect(b.west.lengthM).toBe("18.4");
  });

  it("mines owner names and named streets", async () => {
    const { mineBoundaryDescriptionsFromOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const b = mineBoundaryDescriptionsFromOcr(`
٢٢,٥
شارع محدث بعرض ٦م
٢٢,٧
ملك مصطفى عزوز
١٧
ملك يوسف كاتب
١٤
ملك عبد الوهاب البنا
`);
    expect(b.north.description).toMatch(/شارع عرض 6/);
    expect(b.south.description).toMatch(/ملك/);
    expect(b.east.description).toMatch(/ملك/);
    expect(b.west.description).toMatch(/ملك/);
    expect(b.north.lengthM).toBe("22.5");
  });

  it("parses pure-number length column from croquis OCR", async () => {
    const { parseEdgeLengthsFromCroquisOcr } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    const lens = parseEdgeLengthsFromCroquisOcr(`
٢٤,٢٥
قطعة رقم ٢٢٥
٢٤,٥٠
قطعة رقم ٢٢٩
٢٥,٠٠
شارع عرض ١٥ م
٢٤,٩٥
قطعة رقم ٢٣٦
٦٠٩,٠٠م٢
`);
    expect(lens).toEqual(["24.25", "24.5", "25", "24.95"]);
  });

  it("rejects free-form garbage as description", async () => {
    const { isPlausibleBoundaryDescription } = await import(
      "../src/lib/engineering-survey-sketch-extract"
    );
    expect(isPlausibleBoundaryDescription("هل يوجد اختلاف")).toBe(false);
    expect(isPlausibleBoundaryDescription("قطعة رقم 12")).toBe(true);
  });
});
