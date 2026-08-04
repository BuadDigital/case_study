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

describe("edge lengths only", () => {
  it("extracts lengths and never exposes area or descriptions", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.hasData).toBe(true);
    expect(r.deed.north.lengthM).toBe("24.25");
    expect(r.deed.south.lengthM).toBe("24.50");
    expect(r.deed.east.lengthM).toBe("25.00");
    expect(r.deed.west.lengthM).toBe("24.95");
    expect(r.deed.areaSqm).toBe("");
    for (const d of ["north", "south", "east", "west"] as const) {
      expect(r.deed[d].description).toBe("");
    }
  });

  it("keeps nature lengths; ignores total area differences", () => {
    const r = parseSurveySketchText(croquisTablesText);
    expect(r.nature).not.toBeNull();
    expect(r.deedMatchesNature).toBe("yes");
    expect(r.nature!.areaSqm).toBe("");
    expect(r.nature!.north.lengthM).toBe("24.25");
    expect(r.nature!.west.lengthM).toBe("24.95");
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
    expect(r.deed.west.lengthM).toBe("24.95");
  });

  it("zips length-column decimals", () => {
    const partial = parseBoundaryBlock(`
      الطول/م
      شمال قطعة رقم 225
      جنوب قطعة رقم 229
      شرق شارع عرض 15 م
      غرب قطعة رقم 226
      24.25 24.50 25.00 24.95
    `);
    expect(partial.north.lengthM).toBe("24.25");
    expect(partial.south.lengthM).toBe("24.50");
    expect(partial.east.lengthM).toBe("25.00");
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
    expect(filled.north.lengthM).toBe("24.25");
    expect(filled.east.lengthM).toBe("25.00");
  });

  it("patches length fields only", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {}, true);
    expect(patch.northBoundaryLengthM).toBe("24.25");
    expect(patch.southBoundaryLengthM).toBe("24.50");
    expect(patch.eastBoundaryLengthM).toBe("25.00");
    expect(patch.westBoundaryLengthM).toBe("24.95");
    expect(patch.natureNorthBoundaryLengthM).toBe("24.25");
    expect(Object.keys(patch).every((k) =>
      k === "deedMatchesNature" || k.endsWith("LengthM"),
    )).toBe(true);
  });

  it("nature fields: lengths only", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const n = sketchNatureFieldsFromExtract(r);
    expect(n.natureNorthBoundaryLengthM).toBe("24.25");
    expect(n.natureWestBoundaryLengthM).toBe("24.95");
    expect(Object.keys(n).every((k) => k.endsWith("LengthM"))).toBe(true);
  });

  it("seeds nature lengths from deed form lengths only", () => {
    const n = sketchNatureFieldsFromDeedForm({
      northBoundaryLengthM: "20.00",
      southBoundaryLengthM: "21.00",
    });
    expect(n.natureNorthBoundaryLengthM).toBe("20.00");
    expect(n.natureSouthBoundaryLengthM).toBe("21.00");
  });

  it("labeled prose: different nature lengths → مطابقة لا", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    expect(r.deed.north.lengthM).toBe("25.00");
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

  it("does not overwrite filled length fields", () => {
    const r = parseSurveySketchText(sampleDeedNature);
    const { patch } = sketchExtractToEmptyFieldsPatch(r, {
      northBoundaryLengthM: "99",
    });
    expect(patch.northBoundaryLengthM).toBeUndefined();
    expect(patch.southBoundaryLengthM).toBe("25.00");
  });

  it("overwrites lengths when overwrite=true", () => {
    const r = parseSurveySketchText(croquisTablesText);
    const { patch } = sketchExtractToEmptyFieldsPatch(
      r,
      {
        northBoundaryLengthM: "24.95",
        southBoundaryLengthM: "25.00",
        eastBoundaryLengthM: "24.25",
        westBoundaryLengthM: "24.50",
      },
      true,
    );
    expect(patch.northBoundaryLengthM).toBe("24.25");
    expect(patch.westBoundaryLengthM).toBe("24.95");
  });

  it("spatial: assigns edge lengths by transform orientation", () => {
    const r = parseLengthsFromPositions(croquisLengthOnlyItems);
    expect(r).not.toBeNull();
    expect(r!.deed.north.lengthM).toBe("24.25");
    expect(r!.deed.south.lengthM).toBe("24.50");
    expect(r!.deed.east.lengthM).toBe("25.00");
    expect(r!.deed.west.lengthM).toBe("24.95");
  });
});
