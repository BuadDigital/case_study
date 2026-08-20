import { describe, expect, it } from "vitest";
import type { OrganizationSettingsDto } from "@platform/api-client";
import { emptyValuationReportSettings } from "@platform/api-client";
import { VALUATION_REPORT_TAB_SECTIONS } from "../valuation-report-tab-sections";
import { applyOrgSettingsToReportSections } from "../valuation-report-org-overlay";

function orgWithReport(
  patch: Partial<OrganizationSettingsDto["valuationReport"]>,
): OrganizationSettingsDto {
  return {
    company: { name: "شركة اختبار" },
    evaluator: {},
    valuers: [],
    branding: {
      stampUrl: "",
      signatureUrl: "",
      watermarkText: "",
    },
    communications: {
      otpProvider: "dev-log",
      defaultOtpChannel: "sms",
      smtpPort: 587,
    },
    sla: { defaultBusinessDays: 4, privateSectorBusinessDays: 10 },
    valuation: { maxAdoptedComparables: 3, comparableTimeGapMonths: 6 },
    valuationReport: { ...emptyValuationReportSettings(), ...patch },
    updatedAtUtc: "2026-08-19T00:00:00.000Z",
  };
}

describe("valuation report org overlay", () => {
  it("replaces frozen bullets from settings without touching intake sections", () => {
    const sections = applyOrgSettingsToReportSections(
      VALUATION_REPORT_TAB_SECTIONS,
      orgWithReport({
        keyInputsText: "بند إعدادات واحد",
        professionalStandards: "نص الالتزام من الإعدادات",
        finishingLuxury: "مرجع فاخر من الإعدادات",
      }),
    );
    const inputs = sections.find((s) => s.n === "03");
    const standards = sections.find((s) => s.n === "04");
    const finishing = sections.find((s) => s.n === "12");
    const asset = sections.find((s) => s.n === "06");

    expect(inputs?.bullets).toEqual(["بند إعدادات واحد"]);
    expect(standards?.paragraphs).toEqual(["نص الالتزام من الإعدادات"]);
    expect(finishing?.pairs?.find((p) => p.term === "تشطيب فاخر")?.text).toBe(
      "مرجع فاخر من الإعدادات",
    );
    expect(asset?.fields?.some((f) => f.id === "asset-type")).toBe(true);
  });

  it("keeps template copy when settings texts are empty", () => {
    const original = VALUATION_REPORT_TAB_SECTIONS.find((s) => s.n === "32");
    const sections = applyOrgSettingsToReportSections(
      VALUATION_REPORT_TAB_SECTIONS,
      orgWithReport({ restrictions: "" }),
    );
    expect(sections.find((s) => s.n === "32")?.bullets).toEqual(original?.bullets);
  });
});
