import { describe, expect, it } from "vitest";
import {
  BOURSE_SOURCE_NOTE,
  bourseFeaturePrefill,
  bourseSourceNotes,
  fillEmptyFeaturesFromBourse,
} from "../inspector-bourse-prefill";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";

const property = { classification: "مبنى مفرد", propertyType: "فيلا", deedStatus: "فعال" };

function draft(featureValues: Record<string, string> = {}) {
  return {
    ...createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "PO-1" }),
    featureValues,
  };
}

describe("the bourse answers the inspector's asset type and usage", () => {
  it("takes the type and the classification the specialist chose in the bourse", () => {
    expect(bourseFeaturePrefill(property)).toEqual({
      assetSubject: "فيلا",
      propertyUsage: "مبنى مفرد",
    });
  });

  it("infers the classification of a legacy row that only has a type", () => {
    expect(
      bourseFeaturePrefill({ classification: "", propertyType: "مجمع سكني", deedStatus: "" }).propertyUsage,
    ).toBe("مجمع");
  });

  it("fills every empty field, even after the inspector started, and never overwrites his answer", () => {
    const started = draft({ facade: "شمالية", assetSubject: "شقة" });
    const filled = fillEmptyFeaturesFromBourse(started, property);

    expect(filled.featureValues.assetSubject).toBe("شقة");
    expect(filled.featureValues.propertyUsage).toBe("مبنى مفرد");
    expect(filled.featureValues.facade).toBe("شمالية");
  });

  it("returns the same draft when there is nothing left to fill", () => {
    const full = draft({ assetSubject: "فيلا", propertyUsage: "مبنى مفرد" });
    expect(fillEmptyFeaturesFromBourse(full, property)).toBe(full);
    expect(fillEmptyFeaturesFromBourse(draft(), null)).toBeDefined();
  });

  it("names who completed the bourse and when, when the server recorded it", () => {
    const named = { ...property, bourseCompletedByName: "أسامة الصالحي", bourseCompletedAtUtc: "2026-10-07T08:30:00Z" };
    const notes = bourseSourceNotes({ assetSubject: "فيلا" }, named);
    expect(notes.assetSubject).toBe(`${BOURSE_SOURCE_NOTE} — أدخله أسامة الصالحي · 2026/10/07`);
    // A row completed before names were recorded keeps the stage-only note.
    expect(bourseSourceNotes({ assetSubject: "فيلا" }, property).assetSubject).toBe(BOURSE_SOURCE_NOTE);
  });

  it("notes the source only while the field still holds what the bourse answered", () => {
    expect(bourseSourceNotes({ assetSubject: "فيلا", propertyUsage: "مبنى مفرد" }, property)).toEqual({
      assetSubject: BOURSE_SOURCE_NOTE,
      propertyUsage: BOURSE_SOURCE_NOTE,
    });
    expect(bourseSourceNotes({ assetSubject: "شقة", propertyUsage: "" }, property)).toEqual({});
  });
});
