import { describe, expect, it } from "vitest";
import {
  fillMissingLengthsFromTableContext,
  mergePropertyBoundaryHints,
  parseBoundaryBlock,
  parseFromLengthColumnTable,
  parseLengthsFromPositions,
  parseSurveySketchText,
  sketchExtractToEmptyFieldsPatch,
  sketchNatureFieldsFromExtract,
  sketchNatureFieldsFromDeedForm,
  applyNatureSketchPatch,
  extractSecondaryNatureArea,
  estimateAreaSqmFromBoundaryLengths,
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

describe("parseSurveySketchText — croquis tables", () => {
  it("extracts وصف الحد + lengths from بموجب الصك/الطبيعة tables", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.hasData).toBe(true);
    // Deed section (بموجب الصك) — descriptions
    expect(r.deed.north.description).toMatch(/قطعة رقم 225/);
    expect(r.deed.south.description).toMatch(/قطعة رقم 229/);
    expect(r.deed.east.description).toMatch(/شارع عرض 15/);
    expect(r.deed.west.description).toMatch(/قطعة رقم 226/);
    // Lengths from table (not page position / not rotated edges)
    expect(r.deed.north.lengthM).toBe("24.25");
    expect(r.deed.south.lengthM).toBe("24.50");
    expect(r.deed.east.lengthM).toBe("25.00");
    expect(r.deed.west.lengthM).toBe("24.95");
    expect(r.deed.areaSqm).toMatch(/^609/);
  });

  it("keeps nature separate when area differs (مطابقة = لا)", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.nature).not.toBeNull();
    expect(r.deedMatchesNature).toBe("no");
    expect(r.nature!.areaSqm).toMatch(/^606/);
    expect(r.nature!.north.lengthM).toBe("24.25");
    expect(r.nature!.south.lengthM).toBe("24.50");
    expect(r.nature!.east.lengthM).toBe("25.00");
    expect(r.nature!.west.lengthM).toBe("24.95");
  });

  it("reads lengths from under الطول/م header, not pre-header edge numbers", () => {
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
    expect(r.deed.west.lengthM).toBe("24.95");
  });

  it("zips length-column decimals onto sides that already have descriptions", () => {
    const partial = parseBoundaryBlock(`
      الطول/م
      شمال قطعة رقم 225
      جنوب قطعة رقم 229
      شرق شارع عرض 15 م
      غرب قطعة رقم 226
      24.25 24.50 25.00 24.95
    `);
    expect(partial.north.description).toMatch(/225/);
    // if rows didn't pair, zipLengthColumnDecimals inside parseBoundaryBlock should fill
    expect(partial.north.lengthM).toBe("24.25");
    expect(partial.south.lengthM).toBe("24.50");
    expect(partial.east.lengthM).toBe("25.00");
    expect(partial.west.lengthM).toBe("24.95");
  });

  it("parses a single table block line style", () => {
    const b = parseBoundaryBlock(`
      شمال قطعة رقم 225 24.25
      جنوب قطعة رقم 229 24.50
      شرق شارع عرض 15 م 25.00
      غرب قطعة رقم 226 24.95
      المساحه 609.00 م2
    `);
    expect(b.north.description).toBe("قطعة رقم 225");
    expect(b.south.lengthM).toBe("24.50");
    expect(b.east.description).toContain("شارع");
    expect(b.areaSqm).toBe("609.00");
  });

  it("fills lengths next to descriptions without spatial page order", () => {
    const partial = parseBoundaryBlock(`
      شمال قطعة رقم 225
      جنوب قطعة رقم 229
      شرق شارع عرض 15 م
      غرب قطعة رقم 226
    `);
    // descriptions only
    expect(partial.north.description).toMatch(/225/);
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
    expect(filled.north.lengthM).toBe("24.25");
    expect(filled.south.lengthM).toBe("24.50");
    expect(filled.east.lengthM).toBe("25.00");
    expect(filled.west.lengthM).toBe("24.95");
  });

  it("patches nature fields for the form when nature table exists", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {}, true);
    expect(patch.northBoundaryLengthM).toBe("24.25");
    expect(patch.southBoundaryLengthM).toBe("24.50");
    expect(patch.eastBoundaryLengthM).toBe("25.00");
    expect(patch.westBoundaryLengthM).toBe("24.95");
    expect(patch.onSiteAreaSqm).toMatch(/^609/);
    expect(patch.natureOnSiteAreaSqm).toMatch(/^606/);
    expect(patch.natureNorthBoundaryLengthM).toBe("24.25");
    expect(patch.natureSouthBoundaryLengthM).toBe("24.50");
    expect(patch.deedMatchesNature).toBe("no");
  });

  it("builds nature fields for «لا» from extract (nature table)", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const n = sketchNatureFieldsFromExtract(r);
    expect(n.natureOnSiteAreaSqm).toMatch(/^606/);
    expect(n.natureNorthBoundary).toMatch(/225/);
    expect(n.natureNorthBoundaryLengthM).toBe("24.25");
    expect(n.natureEastBoundaryLengthM).toBe("25.00");
    expect(n.natureWestBoundaryLengthM).toBe("24.95");
  });

  it("seeds nature sides from deed when nature table missing", () => {
    const r = parseSurveySketchText(`
      بموجب الصك
      شمال قطعة رقم 225 24.25
      جنوب قطعة رقم 229 24.50
      شرق شارع عرض 15 م 25.00
      غرب قطعة رقم 226 24.95
      المساحه 609.00 م2
      المساحه 606.49 م2 حسابيا
    `);
    const n = sketchNatureFieldsFromExtract(r);
    expect(n.natureNorthBoundaryLengthM).toBe("24.25");
    expect(n.natureSouthBoundaryLengthM).toBe("24.50");
    expect(n.natureOnSiteAreaSqm).toBe("606.49");
  });

  it("picks nature area 606.49 when OCR dumps bare 609 + 606.49", () => {
    const r = parseSurveySketchText(`
      شمال قطعة رقم 225 24.25
      جنوب قطعة رقم 229 24.50
      شرق شارع عرض 15 م 25.00
      غرب قطعة رقم 226 24.95
    `);
    r.deed.areaSqm = "609";
    r.rawText = `${r.rawText}\nAREA_DIGITS\n609.00 606.49 24.25 25.00`;
    const n = sketchNatureFieldsFromExtract(r);
    expect(n.natureOnSiteAreaSqm).toBe("606.49");
  });

  it("estimates nature area from spatial edge lengths + angle", () => {
    const spatial = parseLengthsFromPositions(croquisLengthOnlyItems)!;
    expect(spatial.estimatedNatureAreaSqm).toBeTruthy();
    // Should be near croquis nature area 606.49 (not deed 609)
    const a = Number(spatial.estimatedNatureAreaSqm);
    expect(a).toBeGreaterThan(600);
    expect(a).toBeLessThan(608);
    const n = sketchNatureFieldsFromExtract({
      rawText: spatial.raw,
      hasData: true,
      deed: {
        areaSqm: "609",
        north: { description: "قطعة رقم 225", lengthM: spatial.deed.north.lengthM },
        south: { description: "قطعة رقم 229", lengthM: spatial.deed.south.lengthM },
        east: { description: "شارع عرض 15 م", lengthM: spatial.deed.east.lengthM },
        west: { description: "قطعة رقم 226", lengthM: spatial.deed.west.lengthM },
      },
      nature: null,
      deedMatchesNature: null,
      filledCount: 4,
      usedSpatialLengths: true,
      estimatedNatureAreaSqm: spatial.estimatedNatureAreaSqm,
      edgeAngleBetweenRad: spatial.edgeAngleBetweenRad,
    });
    expect(Number(n.natureOnSiteAreaSqm)).toBeGreaterThan(600);
    expect(Number(n.natureOnSiteAreaSqm)).toBeLessThan(608);
  });
});

describe("parseSurveySketchText — labeled prose", () => {
  it("extracts deed and nature tables", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    expect(r.hasData).toBe(true);
    expect(r.deed.areaSqm).toBe("625.50");
    expect(r.deed.north.lengthM).toBe("25.00");
    expect(r.nature).not.toBeNull();
    expect(r.deedMatchesNature).toBe("no");
  });

  it("does not invent N/S/E/W from a bare number list", () => {
    const r = parseSurveySketchText(
      "24.25 24.25 25.00 25.00 24.50 24.50 24.95 24.95",
    );
    expect(r.hasData).toBe(false);
  });

  it("does not overwrite filled fields", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {
      onSiteAreaSqm: "999",
      northBoundary: "",
      northBoundaryLengthM: "",
      deedMatchesNature: null,
    });
    expect(patch.onSiteAreaSqm).toBeUndefined();
    expect(patch.northBoundaryLengthM).toBe("25.00");
  });

  it("overwrites existing lengths when overwrite=true (re-upload)", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(
      r,
      {
        northBoundary: "قطعة رقم 225",
        northBoundaryLengthM: "24.95",
        southBoundaryLengthM: "25.00",
        eastBoundaryLengthM: "24.25",
        westBoundaryLengthM: "24.50",
      },
      true,
    );
    expect(patch.northBoundaryLengthM).toBe("24.25");
    expect(patch.southBoundaryLengthM).toBe("24.50");
    expect(patch.eastBoundaryLengthM).toBe("25.00");
    expect(patch.westBoundaryLengthM).toBe("24.95");
  });
});

describe("parseLengthsFromPositions", () => {
  it("assigns croquis edge lengths with transform orientation (not highest-Y = north)", () => {
    const r = parseLengthsFromPositions(croquisLengthOnlyItems);
    expect(r).not.toBeNull();
    // Matches بموجب الصك table on the same PDF:
    // شمال 24.25 · جنوب 24.50 · شرق 25.00 · غرب 24.95
    // (pure page-Y wrongly puts 24.95 west on north)
    expect(r!.deed.north.lengthM).toBe("24.25");
    expect(r!.deed.south.lengthM).toBe("24.50");
    expect(r!.deed.east.lengthM).toBe("25.00");
    expect(r!.deed.west.lengthM).toBe("24.95");
  });
});

describe("mergePropertyBoundaryHints", () => {
  it("never mutates extract from property / بورصة hints", () => {
    const spatial = parseLengthsFromPositions(croquisLengthOnlyItems)!;
    const base = {
      rawText: spatial.raw,
      hasData: true,
      deed: {
        ...spatial.deed,
        areaSqm: "",
        north: { description: "قطعة رقم 225", lengthM: "24.25" },
        south: { ...spatial.deed.south, description: "" },
      },
      nature: null,
      deedMatchesNature: "yes" as const,
      filledCount: 5,
      usedSpatialLengths: false,
    };
    const merged = mergePropertyBoundaryHints(base, {
      areaSqm: "615",
      // legacy extra fields ignored by no-op merge
    } as { areaSqm: string });
    expect(merged.deed.areaSqm).toBe("");
    expect(merged.deed.north.description).toBe("قطعة رقم 225");
    expect(merged.deed.south.description).toBe("");
    expect(merged.deed.north.lengthM).toBe("24.25");
  });

  it("keeps spatial lengths unchanged when hints present", () => {
    const spatial = parseLengthsFromPositions(croquisLengthOnlyItems)!;
    const base = {
      rawText: spatial.raw,
      hasData: true,
      deed: spatial.deed,
      nature: null,
      deedMatchesNature: "yes" as const,
      filledCount: 4,
      usedSpatialLengths: true as const,
    };
    const merged = mergePropertyBoundaryHints(base, { areaSqm: "999" });
    expect(merged.deed.north.lengthM).toBe("24.25");
    expect(merged.deed.south.lengthM).toBe("24.50");
    expect(merged.deed.east.lengthM).toBe("25.00");
    expect(merged.deed.west.lengthM).toBe("24.95");
    expect(merged.deed.north.description).toBe("");
  });

  it("clears stale descriptions on overwrite when croquis has none", () => {
    const r = parseSurveySketchText(
      "24.25 24.50 25.00 24.95 شمال جنوب شرق غرب",
    );
    const { patch } = sketchExtractToEmptyFieldsPatch(
      {
        ...r,
        hasData: true,
        deed: {
          areaSqm: "",
          north: { description: "", lengthM: "25.00" },
          south: { description: "", lengthM: "25.00" },
          east: { description: "", lengthM: "20.00" },
          west: { description: "", lengthM: "20.00" },
        },
        filledCount: 4,
      },
      {
        northBoundary: "قطعة رقم 1054",
        southBoundary: "قطعة رقم 1058",
        eastBoundary: "قطعة رقم 1055",
        westBoundary: "شارع عرض 15م",
        northBoundaryLengthM: "25.00",
      },
      true,
    );
    expect(patch.northBoundary).toBe("");
    expect(patch.southBoundary).toBe("");
    expect(patch.eastBoundary).toBe("");
    expect(patch.westBoundary).toBe("");
    expect(patch.northBoundaryLengthM).toBe("25.00");
  });
});
