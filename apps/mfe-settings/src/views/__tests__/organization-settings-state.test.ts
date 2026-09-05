import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS, ORG_COMPANY_DEFAULTS } from "@platform/api-client";
import {
  buildSettingsSavePayload,
  communicationTestToast,
  emptySettings,
  formatUpdatedAt,
  loadErrorMessage,
  numberOr,
  saveErrorMessage,
  SETTINGS_NUMBER_FALLBACKS,
  TAB_META,
  TABS,
  tabFromSearch,
  tabHref,
  tabLabel,
} from "../organization-settings-state";

describe("tabs", () => {
  it("routes ?tab= to a known tab, branding by link only, company otherwise", () => {
    expect(tabFromSearch("sla")).toBe("sla");
    expect(tabFromSearch("branding")).toBe("branding");
    expect(tabFromSearch("company")).toBe("company");
    expect(tabFromSearch("nope")).toBe("company");
    expect(tabFromSearch(null)).toBe("company");
    expect(TABS.map((t) => t.id)).toEqual(["evaluator", "communications", "sla", "report"]);
    expect(TABS.some((t) => t.id === "branding")).toBe(false);
  });

  it("has meta for every tab id and builds hrefs / labels", () => {
    for (const id of ["company", "evaluator", "branding", "communications", "sla", "report"] as const) {
      expect(TAB_META[id].icon).toBeTruthy();
      expect(TAB_META[id].sub).toBeTruthy();
    }
    expect(tabHref("sla")).toBe("/organization-settings?tab=sla");
    expect(tabLabel("communications")).toBe("الاتصالات");
    expect(tabLabel("branding")).toBeUndefined();
  });
});

describe("emptySettings / save payload", () => {
  it("starts from prototype defaults with dev-log OTP and the SLA defaults", () => {
    const s = emptySettings();
    expect(s.company).toEqual(ORG_COMPANY_DEFAULTS);
    expect(s.branding).toEqual(BRAND_IDENTITY_DEFAULTS);
    expect(s.communications.otpProvider).toBe("dev-log");
    expect(s.communications.smtpPort).toBe(587);
    expect(s.sla).toEqual({ defaultBusinessDays: 4, privateSectorBusinessDays: 10 });
    expect(s.valuation.maxAdoptedComparables).toBe(3);
    expect(Number.isNaN(new Date(s.updatedAtUtc).getTime())).toBe(false);
  });

  it("buildSettingsSavePayload sends every section and drops updatedAtUtc", () => {
    const s = emptySettings();
    const payload = buildSettingsSavePayload(s);
    expect(Object.keys(payload).sort()).toEqual(
      ["branding", "communications", "company", "evaluator", "sla", "valuation", "valuationReport", "valuers"].sort(),
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

  it("communicationTestToast reports provider on success and detail on failure", () => {
    expect(communicationTestToast({ ok: true, provider: "dev-log" })).toEqual({
      text: "تم الإرسال (dev-log)",
      tone: "success",
    });
    expect(communicationTestToast({ ok: true, detail: "OK", provider: "sms" }).text).toBe("OK (sms)");
    expect(communicationTestToast({ ok: false, detail: "boom" })).toEqual({ text: "boom", tone: "error" });
    expect(communicationTestToast({ ok: false }).text).toBe("فشل الاختبار");
  });

  it("numberOr keeps each field's original fallback", () => {
    expect(numberOr("", SETTINGS_NUMBER_FALLBACKS.smtpPort)).toBe(587);
    expect(numberOr("0", SETTINGS_NUMBER_FALLBACKS.defaultBusinessDays)).toBe(1);
    expect(numberOr("x", SETTINGS_NUMBER_FALLBACKS.comparableTimeGapMonths)).toBe(6);
    expect(numberOr("", SETTINGS_NUMBER_FALLBACKS.annualMarketRatePct)).toBe(0);
    expect(numberOr("12", SETTINGS_NUMBER_FALLBACKS.smtpPort)).toBe(12);
  });
});
