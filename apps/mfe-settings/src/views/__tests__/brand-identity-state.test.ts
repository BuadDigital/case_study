import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS, customBrandLogoUrl } from "@platform/api-client";
import {
  BRAND_RESET_TARGETS,
  BRAND_UPLOAD_TARGETS,
  brandAssetView,
  brandImageError,
  cardSaveBlocker,
  clampZoom,
  cmFromInput,
  dragToMm,
  filled,
  fitZoom,
  isBrandCardDefault,
  isTypingTarget,
  isUnsafeSvg,
  letterheadMarginError,
  letterheadMetaText,
  LH_MARGIN_FIELDS,
  lhFieldValue,
  lhGuideCssVars,
  lhGuidePercent,
  lhGuideValue,
  lhThumbGuides,
  logoMetaText,
  mm,
  nextBrandVersion,
  resetConfirmCopy,
  saveStatusLabel,
  stampMetaText,
  stampSizePatch,
  uploadConfirmCopy,
  uploadFileHint,
  uploadToast,
  withCardFields,
} from "../brand-identity-state";
import { a4PageLayout, brandTestPageHtml } from "../brand-test-page";

const D = BRAND_IDENTITY_DEFAULTS;
const ctx = { today: "2026-09-10", actor: "مسؤول النظام", saved: { ...D, logoVersion: "v3" } };

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
    expect(mm(12, 41)).toBe(12);
  });
});

describe("brandAssetView", () => {
  it("uses defaults for every empty field and keeps stored values per guide", () => {
    const view = brandAssetView({ ...D, logoColorUrl: "", stampWidthCm: undefined, letterheadHeadMm: 30 });
    expect(view.logoColor).toBe(D.logoColorUrl);
    expect(view.stampW).toBe(D.stampWidthCm);
    expect(lhGuideValue(view, "letterheadHeadMm")).toBe(30);
    expect(LH_MARGIN_FIELDS.map((f) => f.key)).toEqual([
      "letterheadHeadMm",
      "letterheadFootTopMm",
      "letterheadPadMm",
      "letterheadPadStartMm",
    ]);
  });
});

describe("autosave per card", () => {
  it("saves one card's fields without another card's pending edit", () => {
    const saved = { ...D };
    const draft = { ...D, stampWidthCm: 6, letterheadHeadMm: 50 };

    const payload = withCardFields(saved, draft, "stamp");

    expect(payload.stampWidthCm).toBe(6);
    expect(payload.letterheadHeadMm).toBe(D.letterheadHeadMm);
  });

  it("holds back values that must not be saved", () => {
    expect(cardSaveBlocker("stamp", brandAssetView(D))).toBeNull();
    expect(cardSaveBlocker("stamp", brandAssetView({ ...D, stampWidthCm: 0.2 }))).toContain("الختم");
    expect(cardSaveBlocker("sig", brandAssetView({ ...D, signatureHeightCm: 9 }))).toContain("التوقيع");
    expect(
      cardSaveBlocker("lh", brandAssetView({ ...D, letterheadHeadMm: 280, letterheadFootTopMm: 270 })),
    ).toContain("الهامش الأعلى");
    expect(cardSaveBlocker("logo", brandAssetView(D))).toBeNull();
  });

  it("labels every save state", () => {
    expect(saveStatusLabel({ state: "idle" }).text).toBe("");
    expect(saveStatusLabel({ state: "pending" }).text).toContain("تلقائيًا");
    expect(saveStatusLabel({ state: "saving" }).tone).toBe("progress");
    expect(saveStatusLabel({ state: "saved" }).tone).toBe("ok");
    expect(saveStatusLabel({ state: "blocked", message: "X" }).text).toBe("لم يُحفظ — X");
    expect(saveStatusLabel({ state: "error", message: "Y" }).tone).toBe("danger");
  });
});

describe("letterhead geometry", () => {
  it("places thumbnail guides at true A4 proportion", () => {
    const guides = lhThumbGuides(brandAssetView({ ...D, letterheadHeadMm: 41, letterheadFootTopMm: 270 }));
    expect(guides.headPx).toBeCloseTo(41.41, 1);
    expect(guides.footTopPx).toBeCloseTo(272.73, 1);
    expect(guides.padPx).toBeCloseTo((17 * 212) / 210, 5);
  });

  it("flags margins that leave no content area", () => {
    expect(letterheadMarginError(brandAssetView(D))).toBeNull();
    expect(
      letterheadMarginError(brandAssetView({ ...D, letterheadHeadMm: 200, letterheadFootTopMm: 150 })),
    ).toContain("الهامش الأعلى");
    expect(
      letterheadMarginError(brandAssetView({ ...D, letterheadPadMm: 110, letterheadPadStartMm: 100 })),
    ).toContain("مجموع الهامشين");
  });

  it("maps millimetres to percentages and drag positions back to millimetres", () => {
    expect(lhGuidePercent("letterheadHeadMm", 297)).toBe("100%");
    expect(lhGuideCssVars(brandAssetView({ ...D, letterheadPadMm: 21 }))["--lh-pad"]).toBe("10%");
    const box = { top: 100, left: 50, right: 250, width: 200, height: 400 };
    expect(dragToMm("y", 0, 300, box)).toBe(149);
    expect(dragToMm("xs", 50, 0, box)).toBe(210);
    expect(dragToMm("x", -500, 0, box)).toBe(0);
    expect(lhFieldValue("abc")).toBe(0);
  });

  it("fits the page in the zoom frame and centres it from the right edge", () => {
    const fitted = fitZoom(720, 800);
    expect(fitted.scale).toBeLessThanOrEqual((800 - 32) / 1123);
    expect(fitted.x).toBeLessThan(0);
    expect(clampZoom(9)).toBe(1.5);
    expect(clampZoom(0.01)).toBe(0.3);
  });
});

describe("print sizes", () => {
  it("parses centimetres to tenths and ignores non-positive entries", () => {
    expect(cmFromInput("1.56")).toBe(1.6);
    expect(cmFromInput("0")).toBeNull();
    expect(cmFromInput("")).toBeNull();
  });

  it("keeps the stamp proportion when the aspect lock is on", () => {
    expect(stampSizePatch("width", 4, 0.5)).toEqual({ stampWidthCm: 4, stampHeightCm: 2 });
    expect(stampSizePatch("height", 3, 0.5)).toEqual({ stampHeightCm: 3, stampWidthCm: 6 });
    expect(stampSizePatch("width", 4, null)).toEqual({ stampWidthCm: 4 });
  });

  it("recognises typing targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
  });
});

describe("image checks", () => {
  const png = { name: "a.png", type: "image/png", sizeBytes: 50_000, width: 800, height: 400 };

  it("accepts a sharp PNG stamp and rejects other formats or oversize files", () => {
    expect(brandImageError("stamp", png)).toBeNull();
    expect(brandImageError("stamp", { ...png, type: "image/gif" })).toContain("الصيغ");
    expect(brandImageError("logoWhite", { ...png, sizeBytes: 600 * 1024 })).toContain("يتجاوز");
    expect(brandImageError("signature", { ...png, width: 120, height: 60 })).toContain("دقة");
  });

  it("requires an A4-proportioned, print-resolution letterhead", () => {
    expect(brandImageError("letterhead", { ...png, width: 2480, height: 3508 })).toBeNull();
    expect(brandImageError("letterhead", { ...png, width: 2480, height: 2480 })).toContain("A4");
    expect(brandImageError("letterhead", { ...png, width: 800, height: 1131 })).toContain("دقة");
  });

  it("refuses SVGs with script, handlers or external references", () => {
    expect(isUnsafeSvg("<svg><script>x</script></svg>")).toBe(true);
    expect(isUnsafeSvg('<svg onload="x()"></svg>')).toBe(true);
    expect(isUnsafeSvg('<svg><image href="https://x/y.png"/></svg>')).toBe(true);
    expect(isUnsafeSvg('<svg><path d="M0 0" font-family="x"/></svg>')).toBe(false);
    expect(
      brandImageError("logoColor", {
        ...png,
        type: "image/svg+xml",
        width: 0,
        height: 0,
        svgText: "<svg><script/></svg>",
      }),
    ).toContain("SVG");
  });
});

describe("meta, versions and defaults", () => {
  it("says when the system default is in use instead of inventing an uploader", () => {
    expect(logoMetaText(D)).toContain("الافتراضي");
    expect(stampMetaText(D)).toContain("الافتراضي");
    expect(letterheadMetaText({ ...D, letterheadUrl: "" })).toContain("الافتراضية");
    expect(
      logoMetaText({ ...D, logoWhiteUrl: "data:x", logoVersion: "v4", logoUploadedBy: "سارة" }),
    ).toBe(`الإصدار v4 · ${D.logoUpdatedAt} · رفعه سارة`);
  });

  it("counts versions from the saved copy", () => {
    expect(nextBrandVersion("v3")).toBe("v4");
    expect(nextBrandVersion(null)).toBe("v1");
    expect(BRAND_UPLOAD_TARGETS.logoWhite.patch("u", ctx)).toEqual({
      logoWhiteUrl: "u",
      logoVersion: "v4",
      logoUpdatedAt: ctx.today,
      logoUploadedBy: ctx.actor,
    });
    expect(BRAND_UPLOAD_TARGETS.signature.patch("u", ctx)).toEqual({ signatureUrl: "u" });
  });

  it("resets cards to the system defaults and knows when there is nothing to reset", () => {
    expect(isBrandCardDefault("stamp", D)).toBe(true);
    const custom = { ...D, stampUrl: "data:x", stampWidthCm: 6 };
    expect(isBrandCardDefault("stamp", custom)).toBe(false);
    const reset = { ...custom, ...BRAND_RESET_TARGETS.stamp(ctx) };
    expect(isBrandCardDefault("stamp", reset)).toBe(true);
    expect(isBrandCardDefault("logo", { ...D, ...BRAND_RESET_TARGETS.logo(ctx) })).toBe(true);
    expect(customBrandLogoUrl(D.logoWhiteUrl, D.logoWhiteUrl)).toBeNull();
  });

});

describe("confirm copy", () => {
  it("builds upload / reset dialogs and toasts", () => {
    expect(uploadFileHint("a.png", 12)).toBe("الملف: a.png (12KB).");
    const upload = uploadConfirmCopy("ختم المنشأة", "H.", "F.");
    expect(upload.body.startsWith("F. H. الرفع يُحفظ مباشرة")).toBe(true);
    expect(upload.confirm).toBe("رفع وحفظ");
    expect(uploadToast("x")).toBe("تم رفع x وقُيّد في سجل التدقيق.");
    expect(resetConfirmCopy("الختم").confirm).toBe("استعادة الافتراضي");
  });
});

describe("A4 test page", () => {
  it("cuts the letterhead with the saved margins and prints stamp and signature in cm", () => {
    const view = brandAssetView({ ...D, letterheadFootTopMm: 267, stampWidthCm: 5, stampHeightCm: 2.5 });
    expect(a4PageLayout(view)).toEqual({
      headMm: D.letterheadHeadMm,
      footMm: 30,
      startMm: D.letterheadPadStartMm,
      endMm: D.letterheadPadMm,
    });
    const html = brandTestPageHtml(view);
    expect(html).toContain(".stamp{width:5cm;height:2.5cm");
    expect(html).toContain(`height:${D.letterheadHeadMm}mm`);
    expect(html).toContain("5 سم");
  });

  it("escapes asset URLs inside the page", () => {
    const html = brandTestPageHtml(brandAssetView({ ...D, stampUrl: '/x".png' }));
    expect(html).not.toContain('/x".png');
  });
});
