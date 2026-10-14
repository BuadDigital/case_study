/**
 * Pure decisions about a person's seat in the valuation report, read from the
 * organization roster row linked to their account: seat label, membership
 * completeness, and the message that blocks issuing when the certified valuer
 * is missing or invalid. No React.
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

export function reportSeatLabel(role: string): string {
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function membershipCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    VALUER_ROSTER_MEMBERSHIP_OPTIONS.find((c) => c.value === value)?.label ?? value
  );
}

/** Stock prototype asset — not a real uploaded signature. */
export function isStockSignatureUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  return !u || u.endsWith("ejadah-signature.png");
}

export function signatureUploaded(row: OrganizationValuerRosterEntry): boolean {
  const u = row.signatureUrl?.trim();
  return Boolean(u) && !isStockSignatureUrl(u);
}

export function seatGaps(v: OrganizationValuerRosterEntry, today: string): string[] {
  const gaps: string[] = [];
  if (!v.nameAr.trim()) gaps.push("الاسم");
  if (!v.role?.trim()) gaps.push("الصفة");
  if (!v.membershipCategory?.trim()) gaps.push("فئة العضوية");
  if (!v.membershipNumber?.trim()) gaps.push("رقم العضوية");
  if (!isIsoDate(v.membershipExpiresAt)) gaps.push("سريان العضوية");
  else if (v.membershipExpiresAt! < today) gaps.push("عضوية منتهية");
  // Only the certified valuer signs the report.
  if (v.role === "certified" && !signatureUploaded(v)) gaps.push("التوقيع");
  return gaps;
}

export type SeatStatus = {
  label: string;
  tone: BadgeTone;
  blockReason: string | null;
};

/** How a seated person's row reads on the users list. */
export function seatStatus(v: OrganizationValuerRosterEntry, today: string): SeatStatus {
  if (!v.isActive) {
    return { label: "لا يظهر في التقرير", tone: "default", blockReason: null };
  }
  const gaps = seatGaps(v, today);
  if (gaps.length > 0) {
    return {
      label: "غير مكتمل",
      tone: gaps.includes("عضوية منتهية") ? "danger" : "warning",
      blockReason: `أكمل من بطاقة المستخدم: ${gaps.join(" · ")}`,
    };
  }
  return { label: "فعّال", tone: "success", blockReason: null };
}

/** Empty when a valid certified valuer exists; otherwise why no report can be issued. */
export function certifiedBlockMessage(
  rows: readonly OrganizationValuerRosterEntry[],
  today: string,
): string {
  const c = rows.find((v) => v.role === "certified");
  if (!c) return "لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.";
  const reasons: string[] = [];
  if (!c.isActive) reasons.push("الحساب معطّل");
  if (isIsoDate(c.membershipExpiresAt) && c.membershipExpiresAt! < today) {
    reasons.push("العضوية منتهية");
  }
  if (!signatureUploaded(c)) reasons.push("التوقيع غير مرفوع");
  return reasons.length
    ? `يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («${c.nameAr}») غير صالحة: ${reasons.join(" · ")}.`
    : "";
}

/** Accounts that currently hold a seat (active roster row linked to them). */
export function seatedUserIds(
  rows: readonly OrganizationValuerRosterEntry[],
): Set<string> {
  const ids = new Set<string>();
  for (const v of rows) {
    const id = v.staffUserId?.trim();
    if (id && v.isActive) ids.add(id);
  }
  return ids;
}
