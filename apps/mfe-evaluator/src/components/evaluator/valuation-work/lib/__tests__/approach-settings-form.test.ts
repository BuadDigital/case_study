import { describe, expect, it } from "vitest";
import {
  approachSettingsDraftError,
  approachSettingsDraftRequestFields,
  type ApproachSettingsDraft,
} from "../approach-settings-form";

const base: ApproachSettingsDraft = {
  dateMode: "issue",
  retroKind: "single",
  retroDate: "",
  retroDateEnd: "",
  retroRationale: "",
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

describe("approachSettingsDraftRequestFields", () => {
  it("sends the rationale only for a retrospective date", () => {
    expect(
      approachSettingsDraftRequestFields({ ...base, retroRationale: "مبرر لن يُرسل" }),
    ).toEqual({ retrospectiveRationale: null });
    expect(
      approachSettingsDraftRequestFields({
        ...base,
        dateMode: "retrospective",
        retroRationale: "  طلب المحكمة تقدير القيمة ",
      }),
    ).toEqual({ retrospectiveRationale: "طلب المحكمة تقدير القيمة" });
  });
});
