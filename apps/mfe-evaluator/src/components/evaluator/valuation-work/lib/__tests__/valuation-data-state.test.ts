import { describe, expect, it } from "vitest";
import type {
  ValuationApproachSettingsDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  approachAvailability,
  buildBankFetchOptions,
  costBasisUnitSettingsBody,
  farAdoptedItems,
  hasPositiveFinalOpinion,
  initialSubjectArea,
  inspectorPinOf,
  openFailureMessage,
  openRequestBody,
  subjectAreaSyncPlan,
  subjectIdentity,
} from "../valuation-data-state";

function settings(
  extra: Partial<ValuationApproachSettingsDto> = {},
): ValuationApproachSettingsDto {
  return {
    isSaved: true,
    marketApproachEnabled: true,
    costApproachEnabled: true,
    costApproachAllowed: true,
    costScopeKey: "land_and_building",
    adjustmentsEditUnlocked: false,
    valuationPurposeKey: "sale",
    valuationPurposeNote: null,
    externalSpecialistUsed: false,
    externalSpecialistDetails: null,
    valuationDateMode: "current",
    retrospectiveDate: null,
    retrospectiveDateEnd: null,
    selectedAssumptions: ["a1"],
    ...extra,
  } as unknown as ValuationApproachSettingsDto;
}

function adopted(
  id: string,
  comparable: { city?: string; latitude?: number | null; longitude?: number | null },
): ValuationComparableSelectionDto {
  return {
    id,
    comparablePropertyId: `comp-${id}`,
    isAdopted: true,
    comparable,
  } as unknown as ValuationComparableSelectionDto;
}

describe("approachAvailability", () => {
  it("hides every approach until the settings are saved", () => {
    expect(approachAvailability(null)).toEqual({
      settingsSaved: false,
      marketEnabled: false,
      costEnabled: false,
    });
    expect(approachAvailability(settings({ isSaved: false }))).toMatchObject({
      settingsSaved: false,
      marketEnabled: false,
      costEnabled: false,
    });
  });

  it("gates each approach on its own flags once saved (Q-3: land alone disables cost)", () => {
    expect(approachAvailability(settings())).toEqual({
      settingsSaved: true,
      marketEnabled: true,
      costEnabled: true,
    });
    expect(
      approachAvailability(settings({ marketApproachEnabled: false, costApproachAllowed: false })),
    ).toEqual({ settingsSaved: true, marketEnabled: false, costEnabled: false });
    expect(approachAvailability(settings({ costApproachEnabled: false })).costEnabled).toBe(false);
  });
});

describe("openFailureMessage / openRequestBody", () => {
  it("maps the failure kind to the shell message", () => {
    expect(openFailureMessage("auth")).toBe("يلزم تسجيل الدخول");
    expect(openFailureMessage("network")).toBe("تعذّر الاتصال بخدمة التقييم");
    expect(openFailureMessage("server")).toContain("تعذّر فتح طلب التقييم");
  });

  it("prefers the district hint and falls back to dashes", () => {
    expect(
      openRequestBody(" p-1 ", {
        districtHint: " الروضة ",
        property: { district: "العليا", propertyType: " فيلا " },
      }),
    ).toEqual({ propId: "p-1", area: "الروضة", type: "فيلا", appraiser: "—" });
    expect(openRequestBody("p-1", { property: { district: "العليا" } })).toEqual({
      propId: "p-1",
      area: "العليا",
      type: "—",
      appraiser: "—",
    });
    expect(openRequestBody("p-1", {})).toMatchObject({ area: "—", type: "—" });
  });
});

describe("subjectIdentity", () => {
  it("takes the property first, then the hint, then the intake — trimmed", () => {
    expect(
      subjectIdentity({
        property: { city: " جدة ", district: "" },
        districtHint: " الصفا ",
        intakeProperty: { city: "الرياض", district: "النرجس" } as never,
      }),
    ).toEqual({ city: "جدة", district: "الصفا" });
    expect(
      subjectIdentity({ intakeProperty: { city: "الرياض", district: "النرجس" } as never }),
    ).toEqual({ city: "الرياض", district: "النرجس" });
    expect(subjectIdentity({})).toEqual({ city: "", district: "" });
  });
});

describe("inspectorPinOf", () => {
  it("returns the pin only when both coordinates parse and are not the (0,0) default", () => {
    expect(inspectorPinOf(null)).toBeNull();
    expect(inspectorPinOf({ mapLatitude: "0", mapLongitude: "0" })).toBeNull();
    expect(inspectorPinOf({ mapLatitude: "21.5", mapLongitude: "abc" })).toBeNull();
    expect(inspectorPinOf({ mapLatitude: "21.5", mapLongitude: "39.2" })).toEqual({ lat: 21.5, lng: 39.2 });
  });
});

describe("buildBankFetchOptions", () => {
  it("assembles the query from the property hints with intake fallbacks", () => {
    expect(
      buildBankFetchOptions({
        search: " برج ",
        propertyId: " p-1 ",
        subjectArea: "",
        pin: { lat: 1, lng: 2 },
        districtHint: "الحمراء",
        property: { area: "400", propertyType: " أرض ", deedNumber: "d-9" },
        intakeProperty: { city: "جدة", district: "الشاطئ", locationMapUrl: "https://maps/x" } as never,
      }),
    ).toEqual({
      q: "برج",
      propertyId: "p-1",
      district: "الحمراء",
      city: "جدة",
      deedNumber: "d-9",
      locationMapUrl: "https://maps/x",
      propertyType: "أرض",
      subjectSqm: 400,
      latitude: 1,
      longitude: 2,
    });
  });

  it("sends undefined for blanks and null coordinates without a pin", () => {
    expect(buildBankFetchOptions({ propertyId: "", subjectArea: "250,5", pin: null })).toEqual({
      q: undefined,
      propertyId: undefined,
      district: undefined,
      city: undefined,
      deedNumber: undefined,
      locationMapUrl: undefined,
      propertyType: undefined,
      subjectSqm: 250.5,
      latitude: null,
      longitude: null,
    });
  });
});

describe("initialSubjectArea", () => {
  it("prefers the transaction area over the stored one", () => {
    expect(initialSubjectArea("300", { subjectAreaSqm: 250 })).toBe("300");
    expect(initialSubjectArea("", { subjectAreaSqm: 250 })).toBe("250");
    expect(initialSubjectArea("", { subjectAreaSqm: null })).toBe("");
  });
});

describe("subjectAreaSyncPlan", () => {
  const selection = { subjectAreaSqm: 250, adjustmentBasis: "", analysisNotes: undefined };

  it("skips blank, non-positive, already-synced and matching areas", () => {
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "", selection, lastSyncKey: null })).toBeNull();
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "-4", selection, lastSyncKey: null })).toBeNull();
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "abc", selection, lastSyncKey: null })).toBeNull();
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "250,0005", selection, lastSyncKey: null })).toBeNull();
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "300", selection, lastSyncKey: "r:300" })).toBeNull();
  });

  it("plans one sync per (request, area) with the stored basis defaulted", () => {
    expect(subjectAreaSyncPlan({ requestId: "r", transactionArea: "300,5", selection, lastSyncKey: "r:250" })).toEqual({
      syncKey: "r:300.5",
      body: { subjectAreaSqm: 300.5, adjustmentBasis: "price_per_sqm", analysisNotes: null },
    });
    expect(
      subjectAreaSyncPlan({
        requestId: "r",
        transactionArea: "300",
        selection: { subjectAreaSqm: null, adjustmentBasis: "whole_property", analysisNotes: "n" },
        lastSyncKey: null,
      })?.body,
    ).toEqual({ subjectAreaSqm: 300, adjustmentBasis: "whole_property", analysisNotes: "n" });
  });
});

describe("farAdoptedItems", () => {
  it("uses the city when the subject has no coordinates", () => {
    const near = adopted("a", { city: "جدة" });
    const far = adopted("b", { city: "الرياض" });
    expect(farAdoptedItems([near, far], "جدة", null)).toEqual([far]);
    expect(farAdoptedItems([near, far], "", null)).toEqual([]);
  });

  it("uses the 3 km radius when the subject has coordinates", () => {
    const subject = { lat: 21.5, lng: 39.2 };
    const near = adopted("a", { city: "جدة", latitude: 21.51, longitude: 39.21 });
    const far = adopted("b", { city: "جدة", latitude: 24.7, longitude: 46.7 });
    expect(farAdoptedItems([near, far], "جدة", subject)).toEqual([far]);
  });
});

describe("hasPositiveFinalOpinion", () => {
  it("accepts only a positive number", () => {
    expect(hasPositiveFinalOpinion(1250000)).toBe(true);
    expect(hasPositiveFinalOpinion(0)).toBe(false);
    expect(hasPositiveFinalOpinion(null)).toBe(false);
    expect(hasPositiveFinalOpinion("5")).toBe(false);
  });
});

describe("costBasisUnitSettingsBody", () => {
  it("layers the basis and unit on the saved settings with income kept off", () => {
    expect(costBasisUnitSettingsBody(settings({ selectedAssumptions: undefined }), "reproduction", "quantity_survey")).toEqual({
      marketApproachEnabled: true,
      costApproachEnabled: true,
      incomeApproachEnabled: false,
      costBasisKey: "reproduction",
      costScopeKey: "land_and_building",
      costMeasurementUnitKey: "quantity_survey",
      adjustmentsEditUnlocked: false,
      valuationPurposeKey: "sale",
      valuationPurposeNote: null,
      externalSpecialistUsed: false,
      externalSpecialistDetails: null,
      valuationDateMode: "current",
      retrospectiveDate: null,
      retrospectiveDateEnd: null,
      retrospectiveRationale: null,
      selectedAssumptions: [],
    });
  });
});
