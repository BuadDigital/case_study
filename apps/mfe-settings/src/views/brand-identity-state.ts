/**
 * Pure decisions for the brand-identity screen: asset fallbacks, per-card fields, letterhead
 * geometry and margin checks, image checks, the stamp aspect lock, zoom fitting,
 * upload / apply / reset descriptors and confirm-dialog copy. No React, no DOM writes — the
 * workflow hooks own state and side effects.
 */

import {
  BRAND_IDENTITY_DEFAULTS,
  customBrandLogoUrl,
  type OrganizationBrandingSettings,
} from "@platform/api-client";

export type BrandKey = "logo" | "stamp" | "sig" | "lh";
export type BrandDirty = Record<BrandKey, boolean>;

export const BRAND_KEYS: readonly BrandKey[] = ["logo", "stamp", "sig", "lh"];

export const CLEAN_BRAND_DIRTY: BrandDirty = {
  logo: false,
  stamp: false,
  sig: false,
  lh: false,
};

export const BRAND_CARD_LABELS: Record<BrandKey, string> = {
  logo: "الشعار",
  stamp: "ختم المنشأة",
  sig: "توقيع المقيم المعتمد",
  lh: "كليشة التقرير",
};

const D = BRAND_IDENTITY_DEFAULTS;

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

export function mm(n: number | null | undefined, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/* ---------- per-card fields: one card is saved without another card's draft ---------- */

export const BRAND_CARD_FIELDS: Record<BrandKey, readonly (keyof OrganizationBrandingSettings)[]> = {
  logo: ["logoColorUrl", "logoWhiteUrl", "logoVersion", "logoUpdatedAt", "logoUploadedBy"],
  stamp: ["stampUrl", "stampWidthCm", "stampHeightCm", "stampUpdatedAt", "stampUploadedBy"],
  sig: ["signatureUrl", "signatureWidthCm", "signatureHeightCm"],
  lh: [
    "letterheadUrl",
    "letterheadHeadMm",
    "letterheadFootTopMm",
    "letterheadPadMm",
    "letterheadPadStartMm",
    "letterheadStripMm",
    "letterheadVersion",
    "letterheadUpdatedAt",
  ],
};

/** `base` with one card's fields taken from `source`. */
export function withCardFields(
  base: OrganizationBrandingSettings,
  source: OrganizationBrandingSettings,
  key: BrandKey,
): OrganizationBrandingSettings {
  const next: Record<string, unknown> = { ...base };
  for (const field of BRAND_CARD_FIELDS[key]) next[field] = source[field];
  return next as OrganizationBrandingSettings;
}

/* ---------- autosave ---------- */

/** Typing pause before a size or margin change is saved. */
export const AUTOSAVE_DELAY_MS = 800;

export type CardSaveState = "idle" | "pending" | "saving" | "saved" | "blocked" | "error";
export type CardSaveStatus = { state: CardSaveState; message?: string };

export const IDLE_SAVE_STATUS: Record<BrandKey, CardSaveStatus> = {
  logo: { state: "idle" },
  stamp: { state: "idle" },
  sig: { state: "idle" },
  lh: { state: "idle" },
};

function outsideCm(value: number, min: number, max: number): boolean {
  return value < min || value > max;
}

/** Why a card's current values must not be saved yet, or null. */
export function cardSaveBlocker(key: BrandKey, view: BrandAssetView): string | null {
  switch (key) {
    case "lh":
      return letterheadMarginError(view);
    case "stamp":
      return outsideCm(view.stampW, 0.5, 20) || outsideCm(view.stampH, 0.5, 20)
        ? "مقاس الختم يجب أن يكون بين 0.5 و 20 سم."
        : null;
    case "sig":
      return outsideCm(view.sigH, 0.5, 8) ? "ارتفاع التوقيع يجب أن يكون بين 0.5 و 8 سم." : null;
    default:
      return null;
  }
}

export function saveStatusLabel(status: CardSaveStatus): {
  text: string;
  tone: "muted" | "progress" | "ok" | "danger";
} {
  switch (status.state) {
    case "pending":
      return { text: "تعديلات معلّقة — تُحفظ تلقائيًا", tone: "muted" };
    case "saving":
      return { text: "جاري الحفظ…", tone: "progress" };
    case "saved":
      return { text: "✓ تم الحفظ", tone: "ok" };
    case "blocked":
      return { text: `لم يُحفظ — ${status.message ?? "قيمة غير صالحة"}`, tone: "danger" };
    case "error":
      return { text: `تعذّر الحفظ — ${status.message ?? "حاول مجدداً"}`, tone: "danger" };
    default:
      return { text: "", tone: "muted" };
  }
}

/* ---------- view ---------- */

export const LH_GUIDES = {
  letterheadHeadMm: { cssVar: "--lh-head", span: A4_HEIGHT_MM },
  letterheadFootTopMm: { cssVar: "--lh-foot", span: A4_HEIGHT_MM },
  letterheadPadMm: { cssVar: "--lh-pad", span: A4_WIDTH_MM },
  letterheadPadStartMm: { cssVar: "--lh-pad-start", span: A4_WIDTH_MM },
} as const;

export type LhGuideKey = keyof typeof LH_GUIDES;
export type LhDragAxis = "y" | "x" | "xs";

/** Letterhead margin inputs — rendered in the card and again in the zoom panel. */
export const LH_MARGIN_FIELDS: { key: LhGuideKey; label: string }[] = [
  { key: "letterheadHeadMm", label: "الهامش الأعلى (mm)" },
  { key: "letterheadFootTopMm", label: "الهامش الأسفل — يبدأ من (mm)" },
  { key: "letterheadPadMm", label: "الهامش الأيسر (mm)" },
  { key: "letterheadPadStartMm", label: "الهامش الأيمن (mm)" },
];

/** Every value the cards render, with the defaults filled in. */
export type BrandAssetView = {
  logoColor: string;
  logoWhite: string;
  stamp: string;
  signature: string;
  letterhead: string;
  head: number;
  footTop: number;
  pad: number;
  padStart: number;
  stampW: number;
  stampH: number;
  sigH: number;
};

export function brandAssetView(brand: OrganizationBrandingSettings): BrandAssetView {
  return {
    logoColor: filled(brand.logoColorUrl, D.logoColorUrl!),
    logoWhite: filled(brand.logoWhiteUrl, D.logoWhiteUrl!),
    stamp: filled(brand.stampUrl, D.stampUrl),
    signature: filled(brand.signatureUrl, D.signatureUrl),
    letterhead: filled(brand.letterheadUrl, D.letterheadUrl!),
    head: mm(brand.letterheadHeadMm, D.letterheadHeadMm!),
    footTop: mm(brand.letterheadFootTopMm, D.letterheadFootTopMm!),
    pad: mm(brand.letterheadPadMm, D.letterheadPadMm!),
    padStart: mm(brand.letterheadPadStartMm, D.letterheadPadStartMm!),
    stampW: mm(brand.stampWidthCm, D.stampWidthCm!),
    stampH: mm(brand.stampHeightCm, D.stampHeightCm!),
    sigH: mm(brand.signatureHeightCm, D.signatureHeightCm!),
  };
}

/** Guide value (mm) for one margin key, read off the asset view. */
export function lhGuideValue(view: BrandAssetView, key: LhGuideKey): number {
  switch (key) {
    case "letterheadHeadMm":
      return view.head;
    case "letterheadFootTopMm":
      return view.footTop;
    case "letterheadPadMm":
      return view.pad;
    default:
      return view.padStart;
  }
}

/* ---------- letterhead geometry ---------- */

/** Card thumbnail size — the same 210 × 297 proportion as the page. */
export const LH_THUMB = { widthPx: 212, heightPx: 300 } as const;

/** Guide positions on a thumbnail, in pixels, scaled per axis from millimetres. */
export function lhThumbGuides(
  view: BrandAssetView,
  size: { widthPx: number; heightPx: number } = LH_THUMB,
) {
  const x = size.widthPx / A4_WIDTH_MM;
  const y = size.heightPx / A4_HEIGHT_MM;
  return {
    headPx: view.head * y,
    footTopPx: view.footTop * y,
    padPx: view.pad * x,
    padStartPx: view.padStart * x,
  };
}

/** Null when the four margins leave a content area on the page. */
export function letterheadMarginError(view: BrandAssetView): string | null {
  if (view.footTop > A4_HEIGHT_MM) return "بداية الهامش الأسفل تتجاوز طول الصفحة (297 مم).";
  if (view.head >= view.footTop) return "الهامش الأعلى يجب أن ينتهي قبل بداية الهامش الأسفل.";
  if (view.pad + view.padStart >= A4_WIDTH_MM) {
    return "مجموع الهامشين الأيمن والأيسر يجب أن يكون أقل من عرض الصفحة (210 مم).";
  }
  return null;
}

/** Percentage of the A4 span a guide sits at — the CSS var value painted on the zoom root. */
export function lhGuidePercent(key: LhGuideKey, n: number): string {
  return `${(n / LH_GUIDES[key].span) * 100}%`;
}

export function lhGuideCssVars(view: BrandAssetView): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(LH_GUIDES) as LhGuideKey[]) {
    vars[LH_GUIDES[key].cssVar] = lhGuidePercent(key, lhGuideValue(view, key));
  }
  return vars;
}

export type DragBox = {
  top: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

/** Mouse position inside the (possibly scaled) paper → whole millimetres, clamped to the axis. */
export function dragToMm(
  axis: LhDragAxis,
  clientX: number,
  clientY: number,
  box: DragBox,
): number {
  const raw =
    axis === "y"
      ? ((clientY - box.top) / box.height) * A4_HEIGHT_MM
      : axis === "xs"
        ? ((box.right - clientX) / box.width) * A4_WIDTH_MM
        : ((clientX - box.left) / box.width) * A4_WIDTH_MM;
  const max = axis === "y" ? A4_HEIGHT_MM : A4_WIDTH_MM;
  return Math.min(max, Math.max(0, Math.round(raw)));
}

/** Margin input text → stored millimetres (blank / NaN become 0). */
export function lhFieldValue(value: string): number {
  return Number(value) || 0;
}

/* ---------- zoom ---------- */

/** A4 at 96 dpi — the zoom paper's natural size. */
export const A4_PAPER_PX = { width: 794, height: 1123 } as const;
export const ZOOM_LIMITS = { min: 0.3, max: 1.5, step: 0.1 } as const;

export function clampZoom(n: number): number {
  const rounded = Math.round(n * 100) / 100;
  return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, rounded));
}

/**
 * Scale that shows the whole page in the frame, and the offset that centres it. The paper is
 * anchored to the frame's right edge (RTL), so a negative x moves it left.
 */
export function fitZoom(frameWidth: number, frameHeight: number, padding = 16) {
  const raw = Math.min(
    (frameWidth - padding * 2) / A4_PAPER_PX.width,
    (frameHeight - padding * 2) / A4_PAPER_PX.height,
  );
  const scale = clampZoom(Math.floor(raw * 100) / 100);
  return {
    scale,
    x: -Math.round(Math.max(0, frameWidth - A4_PAPER_PX.width * scale) / 2),
    y: Math.round(Math.max(0, frameHeight - A4_PAPER_PX.height * scale) / 2),
  };
}

/* ---------- print sizes ---------- */

/** Centimetre input → tenths of a cm, or null when the entry must be ignored. */
export function cmFromInput(value: string): number | null {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

/** Kept for the signature field. */
export const signatureHeightFromInput = cmFromInput;

function roundCm(n: number): number {
  return Math.min(20, Math.max(0.5, Math.round(n * 10) / 10));
}

/**
 * Stamp size change. With the aspect lock on (`ratio` = image height / width) the other side
 * follows, so the printed stamp is never stretched.
 */
export function stampSizePatch(
  axis: "width" | "height",
  cm: number,
  ratio: number | null,
): Partial<OrganizationBrandingSettings> {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return axis === "width" ? { stampWidthCm: cm } : { stampHeightCm: cm };
  }
  return axis === "width"
    ? { stampWidthCm: cm, stampHeightCm: roundCm(cm * ratio) }
    : { stampHeightCm: cm, stampWidthCm: roundCm(cm / ratio) };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || Boolean(target.isContentEditable);
}

/* ---------- images ---------- */

export type BrandUploadTargetId =
  | "logoColor"
  | "logoWhite"
  | "stamp"
  | "signature"
  | "letterhead";

export const BRAND_IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;
export const BRAND_IMAGE_ACCEPT = BRAND_IMAGE_TYPES.join(",");

/** Same budgets as the server (`OrganizationBrandingRules`). */
export const BRAND_IMAGE_MAX_BYTES: Record<BrandUploadTargetId, number> = {
  logoColor: 512 * 1024,
  logoWhite: 512 * 1024,
  stamp: 1024 * 1024,
  signature: 1024 * 1024,
  letterhead: 3 * 1024 * 1024,
};

const UNSAFE_SVG = /<script|<foreignobject|\bon[a-z]+\s*=|javascript:|href\s*=\s*["']?\s*(?:https?:|\/\/)/i;

/** SVGs are embedded in printed reports — no script, handlers or external references. */
export function isUnsafeSvg(text: string): boolean {
  return UNSAFE_SVG.test(text);
}

export type BrandImageCandidate = {
  name: string;
  type: string;
  sizeBytes: number;
  width: number;
  height: number;
  svgText?: string | null;
};

/** Minimum long side for crisp print: 1240px ≈ A4 width at 150 dpi; 300px for stamp / signature. */
export function brandImageError(
  target: BrandUploadTargetId,
  file: BrandImageCandidate,
): string | null {
  const type = file.type.toLowerCase();
  const isSvg = type === "image/svg+xml";
  if (!(BRAND_IMAGE_TYPES as readonly string[]).includes(type)) {
    return "الصيغ المسموحة: PNG أو JPG أو SVG.";
  }
  const max = BRAND_IMAGE_MAX_BYTES[target];
  if (file.sizeBytes > max) {
    return `حجم الملف (${Math.round(file.sizeBytes / 1024)}KB) يتجاوز الحد المسموح ${max / 1024}KB.`;
  }
  if (isSvg && isUnsafeSvg(file.svgText ?? "")) {
    return "ملف SVG يحتوي على شيفرة أو روابط خارجية — صدّره من برنامج التصميم بدون سكربتات.";
  }
  if (!isSvg && (file.width <= 0 || file.height <= 0)) return "تعذّر قراءة أبعاد الصورة.";

  if (target === "letterhead" && file.width > 0 && file.height > 0) {
    const ratio = file.height / file.width;
    if (Math.abs(ratio - A4_HEIGHT_MM / A4_WIDTH_MM) > 0.04) {
      return `نسبة الكليشة يجب أن تطابق صفحة A4 (210×297) — أبعاد الملف ${file.width}×${file.height}.`;
    }
    if (!isSvg && file.width < 1240) {
      return "دقة الكليشة منخفضة للطباعة — الحد الأدنى 1240 بكسل عرضًا.";
    }
  }
  if ((target === "stamp" || target === "signature") && !isSvg) {
    if (Math.max(file.width, file.height) < 300) {
      return "دقة الصورة منخفضة للطباعة — الحد الأدنى 300 بكسل للضلع الأطول.";
    }
  }
  return null;
}

/* ---------- meta ---------- */

export function hasCustomLogo(brand: OrganizationBrandingSettings): boolean {
  return Boolean(
    customBrandLogoUrl(brand.logoColorUrl, D.logoColorUrl) ||
      customBrandLogoUrl(brand.logoWhiteUrl, D.logoWhiteUrl),
  );
}

function metaParts(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(" · ");
}

export function logoMetaText(brand: OrganizationBrandingSettings): string {
  if (!hasCustomLogo(brand)) return "الشعار الافتراضي للنظام — لم يُرفع شعار مخصص";
  return metaParts([
    `الإصدار ${brand.logoVersion?.trim() || "v1"}`,
    brand.logoUpdatedAt,
    brand.logoUploadedBy?.trim() ? `رفعه ${brand.logoUploadedBy.trim()}` : null,
  ]);
}

export function stampMetaText(brand: OrganizationBrandingSettings): string {
  if (!customBrandLogoUrl(brand.stampUrl, D.stampUrl)) return "الختم الافتراضي للنظام";
  return metaParts([
    brand.stampUpdatedAt?.trim() ? `آخر رفع: ${brand.stampUpdatedAt.trim()}` : "ختم مرفوع",
    brand.stampUploadedBy,
  ]);
}

export function letterheadMetaText(brand: OrganizationBrandingSettings): string {
  if (!customBrandLogoUrl(brand.letterheadUrl, D.letterheadUrl)) {
    return "الكليشة الافتراضية للنظام";
  }
  return metaParts([
    `الإصدار ${brand.letterheadVersion?.trim() || "v1"}`,
    brand.letterheadUpdatedAt,
  ]);
}

/** v3 → v4; anything unversioned starts at v1. */
export function nextBrandVersion(current: string | null | undefined): string {
  const match = /^v(\d+)$/i.exec(current?.trim() ?? "");
  return match ? `v${Number(match[1]) + 1}` : "v1";
}

/** The card already shows the system defaults — nothing to reset. */
export function isBrandCardDefault(key: BrandKey, brand: OrganizationBrandingSettings): boolean {
  const view = brandAssetView(brand);
  switch (key) {
    case "logo":
      return !hasCustomLogo(brand);
    case "stamp":
      return (
        !customBrandLogoUrl(brand.stampUrl, D.stampUrl) &&
        view.stampW === D.stampWidthCm &&
        view.stampH === D.stampHeightCm
      );
    case "sig":
      return (
        !customBrandLogoUrl(brand.signatureUrl, D.signatureUrl) &&
        view.sigH === D.signatureHeightCm
      );
    default:
      return (
        !customBrandLogoUrl(brand.letterheadUrl, D.letterheadUrl) &&
        view.head === D.letterheadHeadMm &&
        view.footTop === D.letterheadFootTopMm &&
        view.pad === D.letterheadPadMm &&
        view.padStart === D.letterheadPadStartMm
      );
  }
}

/* ---------- upload / reset descriptors ---------- */

export type BrandChangeContext = {
  today: string;
  actor: string;
  /** Last saved branding — versions count from it, not from an unsaved draft. */
  saved: OrganizationBrandingSettings;
};

export type BrandUploadTarget = {
  key: BrandKey;
  label: string;
  hint: string;
  patch: (url: string, ctx: BrandChangeContext) => Partial<OrganizationBrandingSettings>;
};

export const BRAND_UPLOAD_TARGETS: Record<BrandUploadTargetId, BrandUploadTarget> = {
  logoColor: {
    key: "logo",
    label: "الشعار الملون",
    hint: "للخلفيات الفاتحة.",
    patch: (url, ctx) => ({
      logoColorUrl: url,
      logoVersion: nextBrandVersion(ctx.saved.logoVersion),
      logoUpdatedAt: ctx.today,
      logoUploadedBy: ctx.actor,
    }),
  },
  logoWhite: {
    key: "logo",
    label: "الشعار الأبيض",
    hint: "للخلفيات الداكنة — القائمة الجانبية وترويسة التقارير.",
    patch: (url, ctx) => ({
      logoWhiteUrl: url,
      logoVersion: nextBrandVersion(ctx.saved.logoVersion),
      logoUpdatedAt: ctx.today,
      logoUploadedBy: ctx.actor,
    }),
  },
  stamp: {
    key: "stamp",
    label: "ختم المنشأة",
    hint: "أداة اعتماد — صلاحية أضيق وتأكيد مزدوج.",
    patch: (url, ctx) => ({
      stampUrl: url,
      stampUpdatedAt: ctx.today,
      stampUploadedBy: ctx.actor,
    }),
  },
  signature: {
    key: "sig",
    label: "توقيع المقيم المعتمد",
    hint: "يُطبَّق التوقيع ومقاسه في A4 على كل تقرير جديد.",
    patch: (url) => ({ signatureUrl: url }),
  },
  letterhead: {
    key: "lh",
    label: "كليشة التقرير",
    hint: "صفحة A4 كاملة (210×297) تُقص منها الترويسة والتذييل والحافتان.",
    patch: (url, ctx) => ({
      letterheadUrl: url,
      letterheadVersion: nextBrandVersion(ctx.saved.letterheadVersion),
      letterheadUpdatedAt: ctx.today,
    }),
  },
};

export const BRAND_RESET_TARGETS: Record<
  BrandKey,
  (ctx: BrandChangeContext) => Partial<OrganizationBrandingSettings>
> = {
  logo: (ctx) => ({
    logoColorUrl: "",
    logoWhiteUrl: "",
    logoUpdatedAt: ctx.today,
    logoUploadedBy: ctx.actor,
  }),
  stamp: (ctx) => ({
    stampUrl: D.stampUrl,
    stampWidthCm: D.stampWidthCm,
    stampHeightCm: D.stampHeightCm,
    stampUpdatedAt: ctx.today,
    stampUploadedBy: ctx.actor,
  }),
  sig: () => ({
    signatureUrl: D.signatureUrl,
    signatureHeightCm: D.signatureHeightCm,
  }),
  lh: (ctx) => ({
    letterheadUrl: "",
    letterheadHeadMm: D.letterheadHeadMm,
    letterheadFootTopMm: D.letterheadFootTopMm,
    letterheadPadMm: D.letterheadPadMm,
    letterheadPadStartMm: D.letterheadPadStartMm,
    letterheadUpdatedAt: ctx.today,
  }),
};

/* ---------- confirm-dialog copy ---------- */

export type BrandConfirmCopy = { title: string; body: string; confirm: string };

export function uploadFileHint(name: string, kb: number): string {
  return `الملف: ${name} (${kb}KB).`;
}

export function uploadConfirmCopy(
  label: string,
  hint: string,
  fileHint: string,
): BrandConfirmCopy {
  return {
    title: `تأكيد رفع ${label}`,
    body: `${fileHint} ${hint} الرفع يُحفظ مباشرة ويستبدل المعروض في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
    confirm: "رفع وحفظ",
  };
}

export function uploadToast(label: string): string {
  return `تم رفع ${label} وقُيّد في سجل التدقيق.`;
}

export function resetConfirmCopy(label: string): BrandConfirmCopy {
  return {
    title: `استعادة ${label} الافتراضي`,
    body: `يُستبدل ${label} الحالي بالافتراضي للنظام في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
    confirm: "استعادة الافتراضي",
  };
}

export function resetToast(label: string): string {
  return `تمت استعادة ${label} الافتراضي.`;
}

export const SAVE_FAILED_TOAST = "تعذّر اعتماد الأصل";
export const LOAD_FAILED_MESSAGE = "تعذّر تحميل الهوية البصرية";
export const LOGIN_REQUIRED_MESSAGE = "يلزم تسجيل الدخول";
