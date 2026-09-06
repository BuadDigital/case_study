/**
 * Pure decisions for the valuers roster: row completeness, certified-valuer
 * overlay, save payload, guards for role / remove actions and dialog copy.
 * The workflow hook owns state; this module has no React.
 */

import {
  CERTIFIED_VALUER_HTML_DEFAULTS,
  VALUER_ROSTER_HTML_DEFAULTS,
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  VALUER_SYS_ROLES,
  type OrganizationBrandingSettings,
  type OrganizationCompanySettings,
  type OrganizationEvaluatorSettings,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import type { BadgeTone } from "@platform/ui-kit";

export function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): boolean {
  return Boolean(value && ISO_DATE_RE.test(value));
}

export function roleLabel(role: string): string {
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function catLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    VALUER_ROSTER_MEMBERSHIP_OPTIONS.find((c) => c.value === value)?.label ??
    value
  );
}

/** Stock prototype asset — not a real uploaded signature. */
export function isStockSignatureUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  return !u || u.endsWith("ejadah-signature.png");
}

export function sigOk(row: OrganizationValuerRosterEntry): boolean {
  const u = row.signatureUrl?.trim();
  return Boolean(u) && !isStockSignatureUrl(u);
}

export function overlayCertified(
  row: OrganizationValuerRosterEntry,
  evaluator: OrganizationEvaluatorSettings,
  branding: OrganizationBrandingSettings,
): OrganizationValuerRosterEntry {
  const html = CERTIFIED_VALUER_HTML_DEFAULTS;
  return {
    ...row,
    nameAr: filled(evaluator.name, filled(row.nameAr, html.name ?? "")),
    licenseNumber: filled(
      evaluator.licenseNumber,
      filled(row.licenseNumber, html.licenseNumber ?? ""),
    ),
    membershipNumber: filled(
      evaluator.membershipNumber,
      filled(row.membershipNumber, html.membershipNumber ?? ""),
    ),
    membershipCategory: filled(
      evaluator.membershipCategory,
      filled(row.membershipCategory, html.membershipCategory ?? ""),
    ),
    membershipExpiresAt: filled(
      evaluator.membershipExpiresAt,
      filled(row.membershipExpiresAt, html.membershipExpiresAt ?? ""),
    ),
    signatureUrl: (() => {
      const own = row.signatureUrl?.trim() ?? "";
      if (own && !own.endsWith("ejadah-signature.png")) return own;
      const brand = branding.signatureUrl?.trim() ?? "";
      if (brand && !brand.endsWith("ejadah-signature.png")) return brand;
      return null;
    })(),
    role: "certified",
  };
}

export function initialRows(org: OrganizationSettingsDto): OrganizationValuerRosterEntry[] {
  const certId = filled(org.company.certifiedValuerId, "");
  const source =
    org.valuers.length > 0
      ? org.valuers
      : VALUER_ROSTER_HTML_DEFAULTS.map((v) => ({ ...v }));
  const named = filled(org.evaluator.name, "");
  let certIndex = source.findIndex(
    (v) => v.role === "certified" || v.id === certId || (named && v.nameAr === named),
  );
  if (certIndex < 0) certIndex = 0;
  return source.map((v, i) => {
    if (i === certIndex) return overlayCertified(v, org.evaluator, org.branding);
    return {
      ...v,
      role: v.role === "certified" ? "valuer" : v.role,
      signatureUrl: (() => {
        const u = v.signatureUrl?.trim() ?? "";
        if (!u || u.endsWith("ejadah-signature.png")) return null;
        return v.signatureUrl;
      })(),
    };
  });
}

export const NEW_VALUER_NAME = "مقيّم جديد — أكمل البيانات";

export function newValuer(id = `v${Date.now()}`): OrganizationValuerRosterEntry {
  return {
    id,
    nameAr: NEW_VALUER_NAME,
    role: "assistant",
    membershipCategory: "",
    membershipNumber: "",
    membershipExpiresAt: "",
    isActive: true,
    signatureUrl: null,
  };
}

export function completenessGaps(
  v: OrganizationValuerRosterEntry,
  today: string,
): string[] {
  const gaps: string[] = [];
  const name = v.nameAr.trim();
  if (!name || name.includes("أكمل البيانات")) gaps.push("الاسم");
  if (!v.role?.trim()) gaps.push("الدور");
  if (!v.membershipCategory?.trim()) gaps.push("فئة العضوية");
  if (!v.membershipNumber?.trim()) gaps.push("رقم العضوية");
  if (!isIsoDate(v.membershipExpiresAt)) gaps.push("سريان العضوية");
  else if (v.membershipExpiresAt! < today) gaps.push("عضوية منتهية");
  if (!sigOk(v)) gaps.push("التوقيع");
  return gaps;
}

export function isRowComplete(v: OrganizationValuerRosterEntry, today: string): boolean {
  return completenessGaps(v, today).length === 0;
}

export type RosterRowStatus = {
  label: string;
  tone: BadgeTone;
  blockReason: string | null;
};

export function rowStatus(v: OrganizationValuerRosterEntry, today: string): RosterRowStatus {
  if (!v.isActive) {
    return { label: "معطّل — يدوي", tone: "default", blockReason: null };
  }
  const gaps = completenessGaps(v, today);
  if (gaps.length > 0) {
    return {
      label: "غير مكتمل",
      tone: gaps.includes("عضوية منتهية") ? "danger" : "warning",
      blockReason: `أكمل: ${gaps.join(" · ")} — يُمنع الإصدار باسمه`,
    };
  }
  return { label: "فعّال", tone: "success", blockReason: null };
}

/** All row fields are scalar values — no need to serialize the whole record on every keystroke. */
const ROSTER_COMPARED_FIELDS = [
  "id",
  "nameAr",
  "licenseNumber",
  "membershipNumber",
  "membershipCategory",
  "licenseExpiresAt",
  "licenseIssuedAt",
  "membershipExpiresAt",
  "role",
  "isActive",
  "signatureUrl",
] as const satisfies readonly (keyof OrganizationValuerRosterEntry)[];

export function rostersEqual(
  a: OrganizationValuerRosterEntry[],
  b: OrganizationValuerRosterEntry[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    for (const field of ROSTER_COMPARED_FIELDS) {
      if (left[field] !== right[field]) return false;
    }
  }
  return true;
}

export function certBlockMessage(rows: OrganizationValuerRosterEntry[], today: string): string {
  const c = rows.find((v) => v.role === "certified");
  if (!c) return "لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.";
  const reasons: string[] = [];
  if (!c.isActive) reasons.push("الحساب معطّل");
  if (isIsoDate(c.membershipExpiresAt) && c.membershipExpiresAt! < today) {
    reasons.push("العضوية منتهية");
  }
  if (!sigOk(c)) reasons.push("التوقيع غير مرفوع");
  return reasons.length
    ? `يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («${c.nameAr}») غير صالحة: ${reasons.join(" · ")}.`
    : "";
}

export function filterRoster(
  rows: OrganizationValuerRosterEntry[],
  query: string,
): OrganizationValuerRosterEntry[] {
  const q = query.trim();
  return rows.filter((v) => !q || v.nameAr.includes(q));
}

export function incompleteActiveRows(
  rows: OrganizationValuerRosterEntry[],
  today: string,
): OrganizationValuerRosterEntry[] {
  return rows.filter((v) => v.isActive && !isRowComplete(v, today));
}

/* ---------- guards (null = allowed, string = toast to show) ---------- */

export const FINISH_EDIT_BEFORE_ADD =
  "أنهِ تعديل الصف الحالي («تم») قبل إضافة مقيّم جديد.";

export function incompleteBeforeAddMessage(
  incomplete: OrganizationValuerRosterEntry[],
  today: string,
): string {
  const sample = incomplete.slice(0, 2).map((v) => {
    const gaps = completenessGaps(v, today);
    return `«${v.nameAr}» (${gaps.join(" · ")})`;
  });
  const more = incomplete.length > 2 ? ` و${incomplete.length - 2} آخرين` : "";
  return `أكمل بيانات المقيّمين الحاليين قبل الإضافة: ${sample.join("؛ ")}${more}.`;
}

/** Why the "إضافة مقيّم" button is disabled, for its tooltip. */
export function addValuerBlockedTitle(
  canAdd: boolean,
  editingId: string | null,
): string | undefined {
  if (canAdd) return undefined;
  return editingId
    ? "أنهِ تعديل الصف الحالي قبل الإضافة"
    : "أكمل بيانات كل المقيّمين الفعّالين قبل الإضافة";
}

/** The certified role is a singleton: assigned once, never handed over or withdrawn. */
export function rolePatchGuard(
  rows: OrganizationValuerRosterEntry[],
  id: string,
  next: Partial<OrganizationValuerRosterEntry>,
): string | null {
  if (next.role === "certified") {
    const holder = rows.find((v) => v.role === "certified");
    if (holder && holder.id !== id) {
      return `دور «مقيم معتمد» محجوز لـ «${holder.nameAr}» — لا يمكن إسناده لغيره.`;
    }
  }
  if (
    next.role != null &&
    next.role !== "certified" &&
    rows.find((v) => v.id === id)?.role === "certified"
  ) {
    return "لا يمكن سحب دور «مقيم معتمد» بعد إسناده — عطّل الحساب إن لزم دون تغيير الدور.";
  }
  return null;
}

export const CERTIFIED_REMOVE_BLOCKED =
  "لا يمكن حذف المقيّم المعتمد — الدور محجوز بعد إسناده. يمكنك تعطيل الحساب فقط.";

export function finishEditBlockedMessage(
  row: OrganizationValuerRosterEntry,
  today: string,
): string | null {
  if (!row.isActive || isRowComplete(row, today)) return null;
  return `أكمل البيانات قبل «تم»: ${completenessGaps(row, today).join(" · ")}.`;
}

export function roleOptionsFor(isCert: boolean, certifiedHolderId: string | null) {
  return VALUER_SYS_ROLES.filter((r) => {
    if (r.value !== "certified") return true;
    if (isCert) return true;
    return !certifiedHolderId;
  });
}

export function roleSelectTitle(
  isCert: boolean,
  certifiedHolderId: string | null,
): string | undefined {
  if (isCert) return "دور «مقيم معتمد» محجوز بعد إسناده ولا يمكن تغييره";
  if (certifiedHolderId) return "دور «مقيم معتمد» مسند لمقيّم آخر";
  return undefined;
}

export function removeButtonLabel(isNew: boolean, editing: boolean): string {
  if (isNew) return "إزالة الصف";
  return editing ? "إلغاء التعديل" : "حذف";
}

/* ---------- save payload ---------- */

export type RosterSavePayload = {
  company: OrganizationCompanySettings;
  evaluator: OrganizationEvaluatorSettings;
  valuers: OrganizationValuerRosterEntry[];
  branding: OrganizationBrandingSettings;
};

/** Certified row (or the first row) is mirrored onto evaluator / company / branding. */
export function buildRosterSavePayload(
  org: OrganizationSettingsDto,
  nextRows: OrganizationValuerRosterEntry[],
): RosterSavePayload {
  const certified = nextRows.find((v) => v.role === "certified") ?? nextRows[0];
  return {
    company: {
      ...org.company,
      certifiedValuerId: certified?.id ?? org.company.certifiedValuerId,
    },
    evaluator: {
      ...org.evaluator,
      name: certified?.nameAr ?? org.evaluator.name,
      licenseNumber: certified?.licenseNumber ?? org.evaluator.licenseNumber,
      membershipNumber: certified?.membershipNumber ?? org.evaluator.membershipNumber,
      membershipCategory:
        certified?.membershipCategory ?? org.evaluator.membershipCategory,
      membershipExpiresAt:
        certified?.membershipExpiresAt ?? org.evaluator.membershipExpiresAt,
    },
    valuers: nextRows,
    branding: {
      ...org.branding,
      signatureUrl:
        certified?.signatureUrl?.trim() || org.branding.signatureUrl || "",
    },
  };
}

/* ---------- dialog copy & toasts ---------- */

export type RosterConfirmCopy = { title: string; body: string; confirm: string };

export function removeNewRowCopy(name: string): RosterConfirmCopy {
  return {
    title: "إزالة الصف",
    body: `إزالة «${name}» من القائمة؟ سيُحفظ السجل فوراً.`,
    confirm: "إزالة وحفظ",
  };
}

export function discardEditCopy(name: string): RosterConfirmCopy {
  return {
    title: "إلغاء التعديل",
    body: `إلغاء تعديلات «${name}» والرجوع للقيم المحفوظة؟`,
    confirm: "إلغاء التعديل",
  };
}

export function deleteRowCopy(name: string): RosterConfirmCopy {
  return {
    title: "حذف مقيّم",
    body: `حذف «${name}» من السجل وحفظ التغيير فوراً. لن يظهر في التقارير الجديدة.`,
    confirm: "حذف وحفظ",
  };
}

export function disableRowCopy(name: string): RosterConfirmCopy {
  return {
    title: "تعطيل مقيّم",
    body: `«${name}» يبقى مرتبطاً بسجلاته في سجل التدقيق. التعطيل يُحفظ فوراً ويمنع إسناده لأي معاملة جديدة.`,
    confirm: "تعطيل وحفظ",
  };
}

export function signatureUploadCopy(
  name: string,
  hasSignature: boolean,
  fileName: string,
  kb: number,
): RosterConfirmCopy {
  return {
    title: hasSignature ? "استبدال توقيع المقيّم" : "رفع توقيع المقيّم",
    body: `توقيع «${name}» يُطبع في التقارير الجديدة، والرفع يُقيَّد في سجل التدقيق. الملف: ${fileName} (${kb}KB).`,
    confirm: "متابعة الرفع",
  };
}

export const ROSTER_TOASTS = {
  saved: "تم الحفظ وقُيّد في سجل التدقيق.",
  rowSaved: "تم الحفظ.",
  disabled: "تم التعطيل والحفظ.",
  enabled: "تم التفعيل والحفظ.",
  signatureSaved: "تم رفع التوقيع والحفظ.",
  saveFailed: "تعذّر حفظ سجل المقيّمين",
  loadFailed: "تعذّر تحميل سجل المقيّمين",
  loginRequired: "يلزم تسجيل الدخول",
} as const;
