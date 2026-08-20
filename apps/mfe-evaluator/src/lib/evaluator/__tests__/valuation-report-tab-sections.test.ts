import { describe, expect, it } from "vitest";
import {
  VALUATION_REPORT_TAB_SECTIONS,
  catalogKeysUsedInReportTab,
  firstFilledValue,
  layerForSection,
} from "../valuation-report-tab-sections";

describe("valuation report tab sections", () => {
  it("covers the official v3 numbered sections", () => {
    expect(VALUATION_REPORT_TAB_SECTIONS.map((s) => s.n)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
      "38",
    ]);
  });

  it("joins coordinates and license parts", () => {
    expect(
      firstFilledValue(["geo_latitude", "geo_longitude"], {
        geo_latitude: "21.54",
        geo_longitude: "39.17",
      }, "coords"),
    ).toBe("21.54, 39.17");
    expect(
      firstFilledValue(["client_license_number", "client_license_date_h"], {
        client_license_number: "1441/2345",
        client_license_date_h: "1441/03/15",
      }, "license"),
    ).toBe("1441/2345 · 1441/03/15");
  });

  it("collects catalog keys used in the sheet", () => {
    const keys = catalogKeysUsedInReportTab();
    expect(keys).toContain("valuer.name_ar");
    expect(keys).toContain("final.opinion_value");
    expect(keys).toContain("photo.01");
  });

  it("assigns the three consume/work layers", () => {
    expect(layerForSection("01")).toBe("settings");
    expect(layerForSection("05")).toBe("settings");
    expect(layerForSection("12")).toBe("intake");
    expect(layerForSection("34")).toBe("intake");
    expect(layerForSection("02")).toBe("appraiser");
    expect(layerForSection("26")).toBe("appraiser");
    expect(layerForSection("29")).toBe("appraiser");
    expect(layerForSection("27")).toBe("settings");
    expect(layerForSection("38")).toBe("settings");
  });
});
