/**
 * Pure decisions for the valuers roster view: row completeness and status, the
 * certified-valuer block message and the name filter. The roster is read-only
 * here — people and their professional data are edited on the users screen.
 */

import {
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  VALUER_SYS_ROLES,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import type { BadgeTone } from "@platform/ui-kit";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): boolean {
  return Boolean(value && ISO_DATE_RE.test(value));
}

export function roleLabel(role: string): string {
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function isLinkedStaffValuer(row: OrganizationValuerRosterEntry): boolean {
  return Boolean(row.staffUserId?.trim());
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

export function completenessGaps(
  v: OrganizationValuerRosterEntry,
  today: string,
): string[] {
  const gaps: string[] = [];
  if (!v.nameAr.trim()) gaps.push("الاسم");
  if (!v.role?.trim()) gaps.push("الصفة");
  if (!v.membershipCategory?.trim()) gaps.push("فئة العضوية");
  if (!v.membershipNumber?.trim()) gaps.push("رقم العضوية");
  if (!isIsoDate(v.membershipExpiresAt)) gaps.push("سريان العضوية");
  else if (v.membershipExpiresAt! < today) gaps.push("عضوية منتهية");
  // Only the certified valuer signs the report.
  if (v.role === "certified" && !sigOk(v)) gaps.push("التوقيع");
  return gaps;
}

export function isRowComplete(v: OrganizationValuerRosterEntry, today: string): boolean {
  return completenessGaps(v, today).length === 0;
}

type RosterRowStatus = {
  label: string;
  tone: BadgeTone;
  blockReason: string | null;
};

export function rowStatus(v: OrganizationValuerRosterEntry, today: string): RosterRowStatus {
  if (!v.isActive) {
    return { label: "لا يظهر في التقرير", tone: "default", blockReason: null };
  }
  const gaps = completenessGaps(v, today);
  if (gaps.length > 0) {
    return {
      label: "غير مكتمل",
      tone: gaps.includes("عضوية منتهية") ? "danger" : "warning",
      blockReason: `أكمل من بطاقة المستخدم: ${gaps.join(" · ")}`,
    };
  }
  return { label: "فعّال", tone: "success", blockReason: null };
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

/** Certified first, then by name — the order the roster screen lists people in. */
export function sortRoster(
  rows: OrganizationValuerRosterEntry[],
): OrganizationValuerRosterEntry[] {
  return [...rows].sort((a, b) => {
    if (a.role === "certified" && b.role !== "certified") return -1;
    if (b.role === "certified" && a.role !== "certified") return 1;
    return a.nameAr.localeCompare(b.nameAr, "ar");
  });
}

export function filterRoster(
  rows: OrganizationValuerRosterEntry[],
  query: string,
): OrganizationValuerRosterEntry[] {
  const q = query.trim();
  return rows.filter((v) => !q || v.nameAr.includes(q));
}

/** Where a row is edited: its account on the users screen, or nowhere until it is linked. */
export function rosterEditHref(row: OrganizationValuerRosterEntry): string | null {
  const id = row.staffUserId?.trim();
  return id ? `/users?edit=${encodeURIComponent(id)}` : null;
}

export const ROSTER_TOASTS = {
  loadFailed: "تعذّر تحميل سجل المقيّمين",
  loginRequired: "يلزم تسجيل الدخول",
} as const;
