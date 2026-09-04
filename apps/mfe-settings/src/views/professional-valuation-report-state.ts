/**
 * Pure text helpers behind `ProfessionalValuationReportView`: defaults, date and
 * label formatting, and the enabled-list readers. No React, no API calls.
 */
import type { ValuationListItemDto } from "@platform/api-client";
import {
  VALUER_MEMBERSHIP_CATEGORIES,
  VALUER_SYS_ROLES,
} from "@platform/api-client";

export const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
export const FINISH_LABEL_RE = /^(تشطيبات خارجية:|تشطيبات داخلية:)(.*)$/;

export function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

export function slashDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = ISO_DATE_RE.exec(iso);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : iso;
}

export function memLabel(value: string | null | undefined): string {
  return VALUER_MEMBERSHIP_CATEGORIES.find((x) => x.value === value)?.label ?? value ?? "—";
}

export function jobLabel(role: string): string {
  if (role === "valuer") return "مقيم عقاري";
  if (role === "reviewer") return "مقيم عقاري مراجع";
  if (role === "assistant") return "مساعد مقيم";
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function enabledList(
  lists: Record<string, ValuationListItemDto[]> | undefined,
  id: string,
): ValuationListItemDto[] {
  return (lists?.[id] ?? [])
    .filter((r) => r.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function linesOf(text: string): string[] {
  const rows = text.split("\n").map((x) => x.trimEnd());
  return rows.length ? rows : [""];
}
