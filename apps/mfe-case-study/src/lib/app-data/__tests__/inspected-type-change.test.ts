import { describe, expect, it } from "vitest";
import {
  ALL_PROPERTY_TYPES,
  INSPECTOR_FEATURE_FIELDS,
  patchInspectorFeatureValues,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  propertyRequiresSurvey,
  surveyMissingAfterTypeChange,
} from "@platform/app-shared/app-data/po-intake-identifiers";
import { deedMatchOverrideReasonMissing } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { propertyDocumentAppliesToType } from "@platform/app-shared/domain/property-documents/property-document-types";
import { bourseFeaturePrefill } from "../inspector-bourse-prefill";

/** 2026-10-29: the inspector corrects the bourse type on site from the system's full type list. */
describe("the inspector's type comes from the system's list", () => {
  it("offers every property type of the system", () => {
    expect(ALL_PROPERTY_TYPES).toHaveLength(47);
    expect(INSPECTOR_FEATURE_FIELDS.find((f) => f.key === "assetSubject")?.options).toBe(ALL_PROPERTY_TYPES);
  });

  it("prefills the bourse type itself, also the ones the old six options lacked", () => {
    expect(
      bourseFeaturePrefill({ classification: "مجمع", propertyType: "مجمع فلل", deedStatus: "" }).assetSubject,
    ).toBe("مجمع فلل");
    expect(
      bourseFeaturePrefill({ classification: "مرفق عام", propertyType: "استراحة", deedStatus: "" }).assetSubject,
    ).toBe("استراحة");
  });

  it("moves «استخدام العقار» with the type", () => {
    const values = patchInspectorFeatureValues({ propertyUsage: "وحدة داخل مبنى" }, "assetSubject", "فيلا");
    expect(values.propertyUsage).toBe("مبنى مفرد");
  });
});

describe("the survey follows the corrected type", () => {
  const unit = {
    classification: "وحدة داخل مبنى",
    realEstateRegNumber: "",
    identifierType: "deed" as const,
  };

  it("needs a survey once a unit turns out to be a villa, until one is added", () => {
    expect(propertyRequiresSurvey(unit)).toBe(false);
    const villa = { ...unit, inspectedPropertyType: "فيلا" };
    expect(propertyRequiresSurvey(villa)).toBe(true);
    expect(surveyMissingAfterTypeChange(villa, false)).toBe(true);
    expect(surveyMissingAfterTypeChange(villa, true)).toBe(false);
  });
});

describe("«مطابق» against the inspector's «غير مطابق»", () => {
  it("needs a reason of 10 characters", () => {
    expect(deedMatchOverrideReasonMissing("matched", "", true)).toBe(true);
    expect(deedMatchOverrideReasonMissing("matched", "الحدود مطابقة للمخطط", true)).toBe(false);
    expect(deedMatchOverrideReasonMissing("matched", "", false)).toBe(false);
    expect(deedMatchOverrideReasonMissing("differences", "", true)).toBe(false);
  });
});

describe("documents apply by category", () => {
  it("matches the full type names against the short keys", () => {
    expect(propertyDocumentAppliesToType(["أرض"], "أرض سكنية")).toBe(true);
    expect(propertyDocumentAppliesToType(["فيلا", "شقة", "عمارة", "محل تجاري", "مستودع"], "مجمع فلل")).toBe(true);
    expect(propertyDocumentAppliesToType(["فيلا", "شقة", "عمارة", "محل تجاري", "مستودع"], "أرض تجارية")).toBe(false);
    expect(propertyDocumentAppliesToType(["فيلا"], "مجمع فلل")).toBe(false);
  });
});
