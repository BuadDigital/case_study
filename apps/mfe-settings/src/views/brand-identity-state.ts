/**
 * Pure decisions for the brand-identity screen: asset fallbacks, letterhead
 * guide geometry, upload/apply/delete descriptors and confirm-dialog copy.
 * No React, no DOM writes — the workflow hook owns state and side effects.
 */

import {
  BRAND_IDENTITY_DEFAULTS,
  type OrganizationBrandingSettings,
} from "@platform/api-client";

export type BrandKey = "logo" | "stamp" | "sig" | "lh";
export type BrandDirty = Record<BrandKey, boolean>;

export const CLEAN_BRAND_DIRTY: BrandDirty = {
  logo: false,
  stamp: false,
  sig: false,
  lh: false,
};

const D = BRAND_IDENTITY_DEFAULTS;

export function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

export function mm(n: number | null | undefined, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const LH_GUIDES = {
  letterheadHeadMm: { cssVar: "--lh-head", span: 297 },
  letterheadFootTopMm: { cssVar: "--lh-foot", span: 297 },
  letterheadPadMm: { cssVar: "--lh-pad", span: 210 },
  letterheadPadStartMm: { cssVar: "--lh-pad-start", span: 210 },
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

/** Every value the cards render, with the prototype defaults filled in. */
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

export function logoMetaText(brand: OrganizationBrandingSettings): string {
  return `الإصدار ${filled(brand.logoVersion, D.logoVersion!)} · ${filled(brand.logoUpdatedAt, D.logoUpdatedAt!)} · رفعه ${filled(brand.logoUploadedBy, D.logoUploadedBy!)}`;
}

export function stampMetaText(brand: OrganizationBrandingSettings): string {
  return `آخر رفع: ${filled(brand.stampUpdatedAt, D.stampUpdatedAt!)} · ${filled(brand.stampUploadedBy, D.stampUploadedBy!)} · قُيّد في سجل التدقيق`;
}

export function letterheadMetaText(brand: OrganizationBrandingSettings): string {
  return `الإصدار ${filled(brand.letterheadVersion, D.letterheadVersion!)} · ${filled(brand.letterheadUpdatedAt, D.letterheadUpdatedAt!)} · ثلاث شرائح`;
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

/** Mouse position inside the paper → whole millimetres, clamped to the A4 axis. */
export function dragToMm(
  axis: LhDragAxis,
  clientX: number,
  clientY: number,
  box: DragBox,
): number {
  const raw =
    axis === "y"
      ? ((clientY - box.top) / box.height) * 297
      : axis === "xs"
        ? ((box.right - clientX) / box.width) * 210
        : ((clientX - box.left) / box.width) * 210;
  const max = axis === "y" ? 297 : 210;
  return Math.min(max, Math.max(0, Math.round(raw)));
}

/** Margin input text → stored millimetres (blank / NaN become 0). */
export function lhFieldValue(value: string): number {
  return Number(value) || 0;
}

/** Signature height input → tenths of a cm, or null when the entry must be ignored. */
export function signatureHeightFromInput(value: string): number | null {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || Boolean(target.isContentEditable);
}

/* ---------- apply / upload / delete descriptors ---------- */

export type BrandApplyTarget = {
  label: string;
  hint: string;
  payload: (brand: OrganizationBrandingSettings, today: string) => OrganizationBrandingSettings;
};

export const BRAND_APPLY_TARGETS: Record<BrandKey, BrandApplyTarget> = {
  logo: {
    label: "الشعار",
    hint: "تُعتمد نسختا الشعار (الملونة والبيضاء) في كل ما يُصدَر لاحقاً.",
    payload: (brand, today) => ({ ...brand, logoUpdatedAt: today }),
  },
  stamp: {
    label: "ختم المنشأة",
    hint: "أداة اعتماد — يُطبَّق الختم ومقاسه في A4 على كل تقرير جديد، بصلاحية أضيق وتأكيد مزدوج.",
    payload: (brand) => brand,
  },
  sig: {
    label: "توقيع المقيم المعتمد",
    hint: "يُطبَّق التوقيع ومقاسه في A4 على كل تقرير جديد.",
    payload: (brand) => brand,
  },
  lh: {
    label: "كليشة التقرير",
    hint: "تُطبَّق الكليشة وهوامش الصفحة الأربعة على كل ما يُصدَر لاحقاً.",
    payload: (brand, today) => ({
      ...brand,
      letterheadUrl: brand.letterheadUrl?.trim() ? brand.letterheadUrl : D.letterheadUrl,
      letterheadUpdatedAt: today,
    }),
  },
};

export type BrandUploadTargetId =
  | "logoColor"
  | "logoWhite"
  | "stamp"
  | "signature"
  | "letterhead";

export type BrandUploadTarget = {
  key: BrandKey;
  label: string;
  hint: string;
  patch: (url: string, today: string) => Partial<OrganizationBrandingSettings>;
};

export const BRAND_UPLOAD_TARGETS: Record<BrandUploadTargetId, BrandUploadTarget> = {
  logoColor: {
    key: "logo",
    label: "الشعار الملون",
    hint: "المقاس الملزم: متجه SVG.",
    patch: (url, today) => ({ logoColorUrl: url, logoVersion: "v3", logoUpdatedAt: today }),
  },
  logoWhite: {
    key: "logo",
    label: "الشعار الأبيض",
    hint: "المقاس الملزم: متجه SVG على خلفية شفافة.",
    patch: (url, today) => ({ logoWhiteUrl: url, logoVersion: "v3", logoUpdatedAt: today }),
  },
  stamp: {
    key: "stamp",
    label: "ختم المنشأة",
    hint: "أداة اعتماد — صلاحية أضيق وتأكيد مزدوج.",
    patch: (url, today) => ({ stampUrl: url, stampUpdatedAt: today }),
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
    hint: "ثلاث شرائح بمقاسات A4.",
    patch: (url, today) => ({
      letterheadUrl: url,
      letterheadVersion: "v2",
      letterheadUpdatedAt: today,
    }),
  },
};

export type BrandDeleteTargetId = "logoColor" | "logoWhite" | "letterhead";

export const BRAND_DELETE_TARGETS: Record<
  BrandDeleteTargetId,
  { key: BrandKey; patch: Partial<OrganizationBrandingSettings> }
> = {
  logoColor: { key: "logo", patch: { logoColorUrl: "" } },
  logoWhite: { key: "logo", patch: { logoWhiteUrl: "" } },
  letterhead: { key: "lh", patch: { letterheadUrl: "" } },
};

/* ---------- confirm-dialog copy ---------- */

export type BrandConfirmCopy = { title: string; body: string; confirm: string };

export function applyConfirmCopy(label: string, hint: string): BrandConfirmCopy {
  return {
    title: `اعتماد ${label}`,
    body: `${hint} التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
    confirm: "اعتماد وتطبيق",
  };
}

export function applyToast(label: string): string {
  return `تم اعتماد ${label} وتطبيقه.`;
}

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
    body: `${fileHint} ${hint} الرفع يستبدل المعروض في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
    confirm: "رفع واعتماد",
  };
}

export function uploadToast(label: string): string {
  return `تم رفع ${label} وقُيّد في سجل التدقيق.`;
}

export const DELETE_CONFIRM_COPY: BrandConfirmCopy = {
  title: "حذف الأصل",
  body: "حذف الأصل يوقف استخدامه في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها. الإجراء يُقيَّد في سجل التدقيق.",
  confirm: "حذف",
};

export const DELETE_TOAST = "تم حذف الأصل وقُيّد في سجل التدقيق.";
export const SAVE_FAILED_TOAST = "تعذّر اعتماد الأصل";
export const LOAD_FAILED_MESSAGE = "تعذّر تحميل الهوية البصرية";
export const LOGIN_REQUIRED_MESSAGE = "يلزم تسجيل الدخول";
