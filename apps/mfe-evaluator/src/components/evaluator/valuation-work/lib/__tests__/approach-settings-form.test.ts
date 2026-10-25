import { describe, expect, it } from "vitest";
import {
  approachSettingsDraftError,
  approachSettingsDraftRequestFields,
  isLeaseholdInterest,
  normalizeOwnershipInterestKey,
  OWNERSHIP_INTEREST_OPTIONS,
  type ApproachSettingsDraft,
} from "../approach-settings-form";

const base: ApproachSettingsDraft = {
  dateMode: "issue",
  retroKind: "single",
  retroDate: "",
  retroDateEnd: "",
  retroRationale: "",
  ownershipKey: "freehold",
  leaseYearsText: "",
};

describe("approachSettingsDraftError — D9 retrospective rationale", () => {
  it("needs no rationale for the issue date", () => {
    expect(approachSettingsDraftError(base)).toBeNull();
  });

  it("refuses a retrospective save without a rationale of at least 10 characters", () => {
    const retro = { ...base, dateMode: "retrospective", retroDate: "2026-01-01" };
    expect(approachSettingsDraftError(retro)?.key).toBe("retrospectiveRationale");
    expect(
      approachSettingsDraftError({ ...retro, retroRationale: "  قصير  " })?.key,
    ).toBe("retrospectiveRationale");
    expect(
      approachSettingsDraftError({ ...retro, retroRationale: "طلب المحكمة تقدير القيمة" }),
    ).toBeNull();
  });

  it("still checks the dates first", () => {
    expect(
      approachSettingsDraftError({ ...base, dateMode: "retrospective" })?.key,
    ).toBe("retrospectiveDate");
    expect(
      approachSettingsDraftError({
        ...base,
        dateMode: "retrospective",
        retroKind: "range",
        retroDate: "2026-02-01",
        retroDateEnd: "2026-01-01",
        retroRationale: "مبرر كافٍ للتقييم",
      })?.key,
    ).toBe("retrospectiveDateEnd");
  });
});

describe("approachSettingsDraftError — D11 ownership interest", () => {
  it("offers freehold, usufruct and leased land", () => {
    expect(OWNERSHIP_INTEREST_OPTIONS.map((o) => o.labelAr)).toEqual([
      "ملكية تامة",
      "حق منفعة",
      "أرض مستأجرة",
    ]);
  });

  it("requires remaining lease years > 0 for the two leasehold options only", () => {
    for (const key of ["usufruct", "leased_land"]) {
      expect(approachSettingsDraftError({ ...base, ownershipKey: key })?.key).toBe(
        "remainingLeaseYears",
      );
      expect(
        approachSettingsDraftError({ ...base, ownershipKey: key, leaseYearsText: "0" })?.key,
      ).toBe("remainingLeaseYears");
      expect(
        approachSettingsDraftError({ ...base, ownershipKey: key, leaseYearsText: "1000" })?.key,
      ).toBe("remainingLeaseYears");
      expect(
        approachSettingsDraftError({ ...base, ownershipKey: key, leaseYearsText: "١٥" }),
      ).toBeNull();
    }
    expect(approachSettingsDraftError({ ...base, leaseYearsText: "0" })).toBeNull();
  });

  it("normalises unknown keys to freehold", () => {
    expect(normalizeOwnershipInterestKey(" Usufruct ")).toBe("usufruct");
    expect(normalizeOwnershipInterestKey("x")).toBe("freehold");
    expect(isLeaseholdInterest(null)).toBe(false);
    expect(isLeaseholdInterest("leased_land")).toBe(true);
  });
});

describe("approachSettingsDraftRequestFields", () => {
  it("sends the rationale only for a retrospective date and lease years only for a leasehold", () => {
    expect(
      approachSettingsDraftRequestFields({
        ...base,
        retroRationale: "مبرر لن يُرسل",
        leaseYearsText: "9",
      }),
    ).toEqual({
      retrospectiveRationale: null,
      ownershipInterestKey: "freehold",
      remainingLeaseYears: null,
    });
    expect(
      approachSettingsDraftRequestFields({
        ...base,
        dateMode: "retrospective",
        retroRationale: "  طلب المحكمة تقدير القيمة ",
        ownershipKey: "leased_land",
        leaseYearsText: "١٢٫٥",
      }),
    ).toEqual({
      retrospectiveRationale: "طلب المحكمة تقدير القيمة",
      ownershipInterestKey: "leased_land",
      remainingLeaseYears: 12.5,
    });
  });
});
