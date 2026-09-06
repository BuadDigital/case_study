import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS } from "@platform/api-client";
import {
  applyConfirmCopy,
  applyToast,
  BRAND_APPLY_TARGETS,
  BRAND_DELETE_TARGETS,
  BRAND_UPLOAD_TARGETS,
  brandAssetView,
  CLEAN_BRAND_DIRTY,
  DELETE_CONFIRM_COPY,
  dragToMm,
  filled,
  isTypingTarget,
  letterheadMetaText,
  LH_MARGIN_FIELDS,
  lhFieldValue,
  lhGuideCssVars,
  lhGuidePercent,
  lhGuideValue,
  logoMetaText,
  mm,
  signatureHeightFromInput,
  stampMetaText,
  uploadConfirmCopy,
  uploadFileHint,
  uploadToast,
} from "../brand-identity-state";

const D = BRAND_IDENTITY_DEFAULTS;

describe("filled / mm", () => {
  it("falls back on blank strings and negative or NaN numbers", () => {
    expect(filled("  ", "x")).toBe("x");
    expect(filled(null, "x")).toBe("x");
    expect(filled("keep", "x")).toBe("keep");
    // Number(null) is 0, which the screen treats as a real margin; only undefined / NaN fall back.
    expect(mm(null, 41)).toBe(0);
    expect(mm(undefined, 41)).toBe(41);
    expect(mm(-1, 41)).toBe(41);
    expect(mm(Number.NaN, 41)).toBe(41);
    expect(mm(0, 41)).toBe(0);
    expect(mm(12, 41)).toBe(12);
  });
});

describe("brandAssetView", () => {
  it("uses prototype defaults for every empty field", () => {
    const view = brandAssetView({
      ...D,
      logoColorUrl: "",
      stampWidthCm: undefined,
      letterheadHeadMm: -5,
    });
    expect(view.logoColor).toBe(D.logoColorUrl);
    expect(view.stampW).toBe(D.stampWidthCm);
    expect(view.head).toBe(D.letterheadHeadMm);
    expect(view.signature).toBe(D.signatureUrl);
  });

  it("keeps stored values and exposes them per guide key", () => {
    const view = brandAssetView({ ...D, letterheadHeadMm: 30, letterheadPadStartMm: 9 });
    expect(lhGuideValue(view, "letterheadHeadMm")).toBe(30);
    expect(lhGuideValue(view, "letterheadPadStartMm")).toBe(9);
    expect(lhGuideValue(view, "letterheadFootTopMm")).toBe(D.letterheadFootTopMm);
    expect(LH_MARGIN_FIELDS.map((f) => f.key)).toEqual([
      "letterheadHeadMm",
      "letterheadFootTopMm",
      "letterheadPadMm",
      "letterheadPadStartMm",
    ]);
  });
});

describe("meta texts", () => {
  it("compose version / date / uploader with defaults", () => {
    expect(logoMetaText({ ...D, logoVersion: "v9", logoUploadedBy: "" })).toBe(
      `الإصدار v9 · ${D.logoUpdatedAt} · رفعه ${D.logoUploadedBy}`,
    );
    expect(stampMetaText(D)).toContain(D.stampUpdatedAt!);
    expect(stampMetaText(D)).toContain("قُيّد في سجل التدقيق");
    expect(letterheadMetaText({ ...D, letterheadVersion: null })).toContain(
      `الإصدار ${D.letterheadVersion}`,
    );
  });
});

describe("letterhead guide geometry", () => {
  it("maps millimetres to a percentage of the A4 axis", () => {
    expect(lhGuidePercent("letterheadHeadMm", 297)).toBe("100%");
    expect(lhGuidePercent("letterheadPadMm", 105)).toBe("50%");
  });

  it("paints all four CSS vars from the view", () => {
    const vars = lhGuideCssVars(
      brandAssetView({
        ...D,
        letterheadHeadMm: 297,
        letterheadFootTopMm: 0,
        letterheadPadMm: 21,
        letterheadPadStartMm: 105,
      }),
    );
    expect(vars).toEqual({
      "--lh-head": "100%",
      "--lh-foot": "0%",
      "--lh-pad": "10%",
      "--lh-pad-start": "50%",
    });
  });

  it("converts drag positions per axis and clamps to the page", () => {
    const box = { top: 100, left: 50, right: 250, width: 200, height: 400 };
    expect(dragToMm("y", 0, 300, box)).toBe(149); // (200/400)*297 = 148.5 → 149
    expect(dragToMm("x", 150, 0, box)).toBe(105);
    expect(dragToMm("xs", 150, 0, box)).toBe(105);
    expect(dragToMm("xs", 50, 0, box)).toBe(210);
    expect(dragToMm("y", 0, 5000, box)).toBe(297);
    expect(dragToMm("x", -500, 0, box)).toBe(0);
  });
});

describe("input parsing", () => {
  it("lhFieldValue turns blank / NaN into 0", () => {
    expect(lhFieldValue("")).toBe(0);
    expect(lhFieldValue("abc")).toBe(0);
    expect(lhFieldValue("17")).toBe(17);
  });

  it("signatureHeightFromInput rounds to tenths and rejects non-positive", () => {
    expect(signatureHeightFromInput("1.56")).toBe(1.6);
    expect(signatureHeightFromInput("0")).toBeNull();
    expect(signatureHeightFromInput("")).toBeNull();
    expect(signatureHeightFromInput("-2")).toBeNull();
  });

  it("isTypingTarget recognises inputs and editable elements", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("apply / upload / delete descriptors", () => {
  it("apply payload stamps the date only where the screen did", () => {
    const today = "2026-09-05";
    expect(BRAND_APPLY_TARGETS.logo.payload(D, today).logoUpdatedAt).toBe(today);
    expect(BRAND_APPLY_TARGETS.stamp.payload(D, today)).toBe(D);
    expect(BRAND_APPLY_TARGETS.sig.payload(D, today)).toBe(D);
    const lh = BRAND_APPLY_TARGETS.lh.payload({ ...D, letterheadUrl: "  " }, today);
    expect(lh.letterheadUrl).toBe(D.letterheadUrl);
    expect(lh.letterheadUpdatedAt).toBe(today);
    expect(
      BRAND_APPLY_TARGETS.lh.payload({ ...D, letterheadUrl: "data:x" }, today).letterheadUrl,
    ).toBe("data:x");
  });

  it("upload patches carry url, version and date per asset", () => {
    const today = "2026-09-05";
    expect(BRAND_UPLOAD_TARGETS.logoColor.patch("u", today)).toEqual({
      logoColorUrl: "u",
      logoVersion: "v3",
      logoUpdatedAt: today,
    });
    expect(BRAND_UPLOAD_TARGETS.logoWhite.key).toBe("logo");
    expect(BRAND_UPLOAD_TARGETS.stamp.patch("u", today)).toEqual({
      stampUrl: "u",
      stampUpdatedAt: today,
    });
    expect(BRAND_UPLOAD_TARGETS.signature.patch("u", today)).toEqual({ signatureUrl: "u" });
    expect(BRAND_UPLOAD_TARGETS.letterhead.patch("u", today)).toEqual({
      letterheadUrl: "u",
      letterheadVersion: "v2",
      letterheadUpdatedAt: today,
    });
  });

  it("delete targets blank the matching url on the right card", () => {
    expect(BRAND_DELETE_TARGETS.logoColor).toEqual({ key: "logo", patch: { logoColorUrl: "" } });
    expect(BRAND_DELETE_TARGETS.letterhead).toEqual({ key: "lh", patch: { letterheadUrl: "" } });
    expect(CLEAN_BRAND_DIRTY).toEqual({ logo: false, stamp: false, sig: false, lh: false });
  });
});

describe("confirm copy", () => {
  it("builds apply / upload / delete dialogs and toasts", () => {
    expect(applyConfirmCopy("الشعار", "H.")).toEqual({
      title: "اعتماد الشعار",
      body: "H. التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.",
      confirm: "اعتماد وتطبيق",
    });
    expect(applyToast("الشعار")).toBe("تم اعتماد الشعار وتطبيقه.");
    expect(uploadFileHint("a.png", 12)).toBe("الملف: a.png (12KB).");
    const up = uploadConfirmCopy("ختم المنشأة", "H.", "F.");
    expect(up.title).toBe("تأكيد رفع ختم المنشأة");
    expect(up.body.startsWith("F. H. الرفع يستبدل")).toBe(true);
    expect(up.confirm).toBe("رفع واعتماد");
    expect(uploadToast("x")).toBe("تم رفع x وقُيّد في سجل التدقيق.");
    expect(DELETE_CONFIRM_COPY.confirm).toBe("حذف");
  });
});
