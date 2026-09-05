import { describe, expect, it } from "vitest";
import {
  BRAND_IDENTITY_DEFAULTS,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  ORG_COMPANY_DEFAULTS,
  VALUER_ROSTER_HTML_DEFAULTS,
  emptyValuationReportSettings,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import {
  addValuerBlockedTitle,
  buildRosterSavePayload,
  catLabel,
  certBlockMessage,
  completenessGaps,
  deleteRowCopy,
  disableRowCopy,
  discardEditCopy,
  filterRoster,
  finishEditBlockedMessage,
  incompleteActiveRows,
  incompleteBeforeAddMessage,
  initialRows,
  isIsoDate,
  isRowComplete,
  isStockSignatureUrl,
  newValuer,
  overlayCertified,
  removeButtonLabel,
  removeNewRowCopy,
  roleLabel,
  roleOptionsFor,
  rolePatchGuard,
  roleSelectTitle,
  rostersEqual,
  rowStatus,
  sigOk,
  signatureUploadCopy,
} from "../valuers-roster-state";

const TODAY = "2026-09-05";

function row(patch: Partial<OrganizationValuerRosterEntry> = {}): OrganizationValuerRosterEntry {
  return {
    id: "v1",
    nameAr: "عماد",
    role: "valuer",
    membershipCategory: "fellow",
    membershipNumber: "1210000003",
    membershipExpiresAt: "2027-01-01",
    isActive: true,
    signatureUrl: "data:image/png;base64,abc",
    ...patch,
  };
}

function org(patch: Partial<OrganizationSettingsDto> = {}): OrganizationSettingsDto {
  return {
    company: { ...ORG_COMPANY_DEFAULTS },
    evaluator: { ...CERTIFIED_VALUER_HTML_DEFAULTS },
    valuers: [],
    branding: { ...BRAND_IDENTITY_DEFAULTS },
    communications: { otpProvider: "dev-log", defaultOtpChannel: "sms" },
    sla: { defaultBusinessDays: 4, privateSectorBusinessDays: 10 },
    valuation: {
      maxAdoptedComparables: 3,
      comparableTimeGapMonths: 6,
      areaFactorPct: 5,
      annualMarketRatePct: 4,
      marketValueRoundDecimals: 4,
    },
    valuationReport: emptyValuationReportSettings(),
    updatedAtUtc: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("labels and predicates", () => {
  it("resolves role / category labels and falls back to the raw value", () => {
    expect(roleLabel("certified")).toBe("مقيم معتمد");
    expect(roleLabel("other")).toBe("other");
    expect(catLabel("fellow")).toBe("عضو أساسي زميل");
    expect(catLabel("")).toBe("—");
    expect(catLabel("zzz")).toBe("zzz");
  });

  it("detects ISO dates and stock signatures", () => {
    expect(isIsoDate("2026-09-05")).toBe(true);
    expect(isIsoDate("5/9/2026")).toBe(false);
    expect(isStockSignatureUrl("/case-study/ejadah-signature.png")).toBe(true);
    expect(isStockSignatureUrl("")).toBe(true);
    expect(isStockSignatureUrl("data:x")).toBe(false);
    expect(sigOk(row())).toBe(true);
    expect(sigOk(row({ signatureUrl: "/case-study/ejadah-signature.png" }))).toBe(false);
  });
});

describe("completeness", () => {
  it("lists every gap in screen order", () => {
    const gaps = completenessGaps(
      row({
        nameAr: "مقيّم جديد — أكمل البيانات",
        role: "",
        membershipCategory: "",
        membershipNumber: "",
        membershipExpiresAt: "",
        signatureUrl: null,
      }),
      TODAY,
    );
    expect(gaps).toEqual(["الاسم", "الدور", "فئة العضوية", "رقم العضوية", "سريان العضوية", "التوقيع"]);
  });

  it("flags an expired membership and reports status tones", () => {
    const expired = row({ membershipExpiresAt: "2020-01-01" });
    expect(completenessGaps(expired, TODAY)).toEqual(["عضوية منتهية"]);
    expect(rowStatus(expired, TODAY)).toEqual({
      label: "غير مكتمل",
      tone: "danger",
      blockReason: "أكمل: عضوية منتهية — يُمنع الإصدار باسمه",
    });
    expect(rowStatus(row({ signatureUrl: null }), TODAY).tone).toBe("warning");
    expect(rowStatus(row(), TODAY)).toEqual({ label: "فعّال", tone: "success", blockReason: null });
    expect(rowStatus(row({ isActive: false, signatureUrl: null }), TODAY).label).toBe("معطّل — يدوي");
    expect(isRowComplete(row(), TODAY)).toBe(true);
  });

  it("finishEditBlockedMessage only blocks active incomplete rows", () => {
    expect(finishEditBlockedMessage(row(), TODAY)).toBeNull();
    expect(finishEditBlockedMessage(row({ isActive: false, signatureUrl: null }), TODAY)).toBeNull();
    expect(finishEditBlockedMessage(row({ signatureUrl: null }), TODAY)).toBe(
      "أكمل البيانات قبل «تم»: التوقيع.",
    );
  });

  it("incompleteActiveRows + incompleteBeforeAddMessage sample two rows", () => {
    const rows = [
      row({ id: "a", nameAr: "أ", signatureUrl: null }),
      row({ id: "b", nameAr: "ب", membershipNumber: "" }),
      row({ id: "c", nameAr: "ج", isActive: false, signatureUrl: null }),
      row({ id: "d", nameAr: "د", role: "" }),
    ];
    const incomplete = incompleteActiveRows(rows, TODAY);
    expect(incomplete.map((r) => r.id)).toEqual(["a", "b", "d"]);
    expect(incompleteBeforeAddMessage(incomplete, TODAY)).toBe(
      "أكمل بيانات المقيّمين الحاليين قبل الإضافة: «أ» (التوقيع)؛ «ب» (رقم العضوية) و1 آخرين.",
    );
    expect(addValuerBlockedTitle(true, null)).toBeUndefined();
    expect(addValuerBlockedTitle(false, "x")).toBe("أنهِ تعديل الصف الحالي قبل الإضافة");
    expect(addValuerBlockedTitle(false, null)).toBe("أكمل بيانات كل المقيّمين الفعّالين قبل الإضافة");
  });
});

describe("initialRows / overlayCertified", () => {
  it("falls back to the prototype roster and overlays evaluator data on the certified row", () => {
    const rows = initialRows(org());
    expect(rows.length).toBe(VALUER_ROSTER_HTML_DEFAULTS.length);
    const cert = rows.find((r) => r.role === "certified")!;
    expect(cert.nameAr).toBe(CERTIFIED_VALUER_HTML_DEFAULTS.name);
    // Stock signature never counts as uploaded.
    expect(cert.signatureUrl).toBeNull();
    expect(rows.filter((r) => r.role === "certified")).toHaveLength(1);
  });

  it("picks the certified row by id or name and demotes any other certified row", () => {
    const o = org({
      valuers: [
        row({ id: "x", role: "certified", nameAr: "أ" }),
        row({ id: "y", role: "valuer", nameAr: "ب" }),
      ],
      company: { ...ORG_COMPANY_DEFAULTS, certifiedValuerId: "y" },
      evaluator: { ...CERTIFIED_VALUER_HTML_DEFAULTS, name: "ب" },
    });
    const rows = initialRows(o);
    // First match wins — "x" is certified already.
    expect(rows[0]!.role).toBe("certified");
    expect(rows[0]!.nameAr).toBe("ب");
    expect(rows[1]!.role).toBe("valuer");
  });

  it("overlayCertified prefers evaluator values, then the row, then html defaults", () => {
    const out = overlayCertified(
      row({ licenseNumber: "", signatureUrl: "/case-study/ejadah-signature.png" }),
      { name: "", licenseNumber: "L" },
      { ...BRAND_IDENTITY_DEFAULTS, signatureUrl: "data:brand" },
    );
    expect(out.nameAr).toBe("عماد");
    expect(out.licenseNumber).toBe("L");
    expect(out.signatureUrl).toBe("data:brand");
    expect(out.role).toBe("certified");
  });
});

describe("row helpers", () => {
  it("newValuer / filterRoster / rostersEqual", () => {
    const n = newValuer("v9");
    expect(n.id).toBe("v9");
    expect(n.role).toBe("assistant");
    expect(filterRoster([row({ nameAr: "عماد" }), row({ id: "2", nameAr: "سعد" })], " عماد ")).toHaveLength(1);
    expect(rostersEqual([row()], [row()])).toBe(true);
    expect(rostersEqual([row()], [row({ nameAr: "x" })])).toBe(false);
    expect(rostersEqual([row()], [])).toBe(false);
  });

  it("certBlockMessage explains why issuing is blocked", () => {
    expect(certBlockMessage([row()], TODAY)).toBe("لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.");
    expect(certBlockMessage([row({ role: "certified" })], TODAY)).toBe("");
    expect(
      certBlockMessage(
        [row({ role: "certified", isActive: false, membershipExpiresAt: "2020-01-01", signatureUrl: null })],
        TODAY,
      ),
    ).toBe(
      "يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («عماد») غير صالحة: الحساب معطّل · العضوية منتهية · التوقيع غير مرفوع.",
    );
  });

  it("rolePatchGuard reserves the certified role", () => {
    const rows = [row({ id: "c", role: "certified", nameAr: "المعتمد" }), row({ id: "o" })];
    expect(rolePatchGuard(rows, "o", { role: "certified" })).toContain("محجوز لـ «المعتمد»");
    expect(rolePatchGuard(rows, "c", { role: "valuer" })).toContain("لا يمكن سحب دور");
    expect(rolePatchGuard(rows, "c", { role: "certified" })).toBeNull();
    expect(rolePatchGuard(rows, "o", { nameAr: "x" })).toBeNull();
    expect(rolePatchGuard([row({ id: "o" })], "o", { role: "certified" })).toBeNull();
  });

  it("role options / titles / remove labels", () => {
    expect(roleOptionsFor(false, "c").some((r) => r.value === "certified")).toBe(false);
    expect(roleOptionsFor(true, "c").some((r) => r.value === "certified")).toBe(true);
    expect(roleOptionsFor(false, null).some((r) => r.value === "certified")).toBe(true);
    expect(roleSelectTitle(true, "c")).toContain("محجوز");
    expect(roleSelectTitle(false, "c")).toContain("مسند لمقيّم آخر");
    expect(roleSelectTitle(false, null)).toBeUndefined();
    expect(removeButtonLabel(true, true)).toBe("إزالة الصف");
    expect(removeButtonLabel(false, true)).toBe("إلغاء التعديل");
    expect(removeButtonLabel(false, false)).toBe("حذف");
  });
});

describe("buildRosterSavePayload", () => {
  it("mirrors the certified row onto company / evaluator / branding", () => {
    const o = org();
    const rows = [row({ id: "o" }), row({ id: "c", role: "certified", nameAr: "ن", signatureUrl: "data:sig" })];
    const payload = buildRosterSavePayload(o, rows);
    expect(payload.company.certifiedValuerId).toBe("c");
    expect(payload.evaluator.name).toBe("ن");
    expect(payload.evaluator.title).toBe(o.evaluator.title);
    expect(payload.branding.signatureUrl).toBe("data:sig");
    expect(payload.valuers).toBe(rows);
  });

  it("falls back to the first row, then to the stored organization", () => {
    const o = org();
    const rows = [row({ id: "first", nameAr: "أول", signatureUrl: null })];
    const payload = buildRosterSavePayload(o, rows);
    expect(payload.company.certifiedValuerId).toBe("first");
    expect(payload.branding.signatureUrl).toBe(o.branding.signatureUrl);
    const empty = buildRosterSavePayload(o, []);
    expect(empty.evaluator.name).toBe(o.evaluator.name);
    expect(empty.company.certifiedValuerId).toBe(o.company.certifiedValuerId);
  });
});

describe("dialog copy", () => {
  it("names the row in every dialog", () => {
    expect(removeNewRowCopy("س").body).toContain("«س»");
    expect(discardEditCopy("س").confirm).toBe("إلغاء التعديل");
    expect(deleteRowCopy("س").confirm).toBe("حذف وحفظ");
    expect(disableRowCopy("س").title).toBe("تعطيل مقيّم");
    expect(signatureUploadCopy("س", false, "f.png", 3).title).toBe("رفع توقيع المقيّم");
    expect(signatureUploadCopy("س", true, "f.png", 3).body).toContain("الملف: f.png (3KB).");
  });
});
