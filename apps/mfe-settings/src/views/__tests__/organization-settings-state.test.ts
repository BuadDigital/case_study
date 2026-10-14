import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS, ORG_COMPANY_DEFAULTS } from "@platform/api-client";
import {
  buildSettingsSavePayload,
  emptySettings,
  formatUpdatedAt,
  loadErrorMessage,
  numberOr,
  saveErrorMessage,
  SETTINGS_NUMBER_FALLBACKS,
  TAB_META,
  TABS,
  tabFromSearch,
  tabLabel,
} from "../organization-settings-state";

describe("tabs", () => {
  it("routes ?tab= to a known tab, branding by link only, company otherwise", () => {
    expect(tabFromSearch("sla")).toBe("sla");
    expect(tabFromSearch("branding")).toBe("branding");
    expect(tabFromSearch("company")).toBe("company");
    expect(tabFromSearch("nope")).toBe("company");
    expect(tabFromSearch(null)).toBe("company");
    expect(TABS.map((t) => t.id)).toEqual(["evaluator", "sla", "report"]);
    expect(TABS.some((t) => t.id === "branding")).toBe(false);
  });

  it("has meta for every tab id and builds labels", () => {
    for (const id of ["sla"] as const) {
      expect(TAB_META[id].icon).toBeTruthy();
      expect(TAB_META[id].sub).toBeTruthy();
    }
    expect(tabLabel("sla")).toBe("وقت التنفيذ");
    expect(tabLabel("branding")).toBeUndefined();
  });
});

describe("emptySettings / save payload", () => {
  it("starts from prototype defaults with the SLA defaults", () => {
    const s = emptySettings();
    expect(s.company).toEqual(ORG_COMPANY_DEFAULTS);
    expect(s.branding).toEqual(BRAND_IDENTITY_DEFAULTS);
    expect(s.sla).toEqual({ defaultBusinessDays: 4, privateSectorBusinessDays: 10 });
    expect(s.valuation.maxAdoptedComparables).toBe(3);
    expect(Number.isNaN(new Date(s.updatedAtUtc).getTime())).toBe(false);
  });

  it("buildSettingsSavePayload sends every section and drops updatedAtUtc", () => {
    const s = emptySettings();
    const payload = buildSettingsSavePayload(s);
    expect(Object.keys(payload).sort()).toEqual(
      ["branding", "company", "evaluator", "sla", "valuation", "valuationReport", "valuers"].sort(),
    );
    expect(payload.sla).toBe(s.sla);
    expect("updatedAtUtc" in payload).toBe(false);
  });
});

describe("messages", () => {
  it("formatUpdatedAt handles invalid dates", () => {
    expect(formatUpdatedAt("not-a-date")).toBe("—");
    expect(formatUpdatedAt("2026-09-05T10:00:00Z")).not.toBe("—");
  });

  it("maps load / save failures", () => {
    expect(loadErrorMessage("forbidden")).toBe("لا تملك صلاحية عرض إعدادات المنشأة");
    expect(loadErrorMessage("network")).toBe("تعذّر الاتصال بالخادم");
    expect(loadErrorMessage("server")).toBe("تعذّر تحميل الإعدادات");
    expect(saveErrorMessage({ kind: "forbidden", message: "custom" })).toBe("custom");
    expect(saveErrorMessage({ kind: "forbidden" })).toBe("لا تملك صلاحية حفظ الإعدادات");
    expect(saveErrorMessage({ kind: "server", message: null })).toBe("تعذّر حفظ الإعدادات");
  });


  it("numberOr keeps each field's original fallback", () => {
    expect(numberOr("", SETTINGS_NUMBER_FALLBACKS.areaFactorPct)).toBe(5);
    expect(numberOr("0", SETTINGS_NUMBER_FALLBACKS.defaultBusinessDays)).toBe(1);
    expect(numberOr("", SETTINGS_NUMBER_FALLBACKS.annualMarketRatePct)).toBe(0);
    expect(numberOr("12", SETTINGS_NUMBER_FALLBACKS.areaFactorPct)).toBe(12);
  });
});
