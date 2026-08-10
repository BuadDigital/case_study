import type { InspectorFeeRowDto } from "@platform/api-client";
import type { StaffUser } from "../prototype/constants";

const TASK_KIND_CATEGORY: Record<string, string> = {
  "field-inspection": "المعاينون",
  "engineering-survey": "المكاتب الهندسية",
  "court-visit": "أتعاب زيارة المحكمة",
  "government-review": "أتعاب زيارة المحكمة",
};

/** Seed / distribution assignee ids → Arabic display when staff lookup is empty. */
const ASSIGNEE_DISPLAY_FALLBACKS: Record<string, string> = {
  "fi-abdullah-abdulmane": "عبدالله عبدالمانع",
  "fi-ahmed": "أحمد سعيد",
  "gov-firas": "فراس كمرين",
  "val-abdullah": "عبدالله الكثيري",
  "eo-jeddah": "مكتب جدة للمساحة",
  "vc-mohammed-diab": "محمد دياب",
};

/**
 * Reject machine assignee ids used as “names” (e.g. fi-abdullah-abdulmane).
 */
function looksLikeAssigneeIdCode(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (/^(fi|gov|val|eo|vc|cs|insp|office)-/i.test(t)) return true;
  // Pure latin technical tokens without Arabic letters
  if (/^[a-z0-9._-]+$/i.test(t) && !/[\u0600-\u06FF]/.test(t)) return true;
  return false;
}

export type PartyFeeGroup = {
  assigneeId: string;
  name: string;
  category: string;
  rows: InspectorFeeRowDto[];
};

export function partyCategoryFromRow(row: InspectorFeeRowDto): string {
  return TASK_KIND_CATEGORY[row.taskKind] ?? row.taskKind;
}

export function buildAssigneeStaffIndex(
  staffUsers: StaffUser[],
): Map<string, StaffUser> {
  const byAssignee = new Map<string, StaffUser>();
  for (const user of staffUsers) {
    const id = user.distributionAssigneeId?.trim();
    if (id) byAssignee.set(id, user);
  }
  return byAssignee;
}

export function resolvePartyName(
  assigneeId: string | null | undefined,
  staffUsers: StaffUser[],
): string {
  const key = assigneeId?.trim();
  if (!key) return "—";
  const staffName = buildAssigneeStaffIndex(staffUsers).get(key)?.name?.trim();
  if (staffName && isUsableAssigneeDisplayName(staffName)) return staffName;
  return ASSIGNEE_DISPLAY_FALLBACKS[key] ?? (looksLikeAssigneeIdCode(key) ? "—" : key);
}

/** Generic role labels stored as AssigneeName instead of a person/office name. */
const GENERIC_ASSIGNEE_LABELS = new Set(
  [
    "معاين ميداني",
    "المعاين",
    "المعاين الميداني",
    "المعاين العقاري",
    "مراجع حكومي",
    "المراجع الحكومي",
    "مقيم عقاري",
    "المقيم العقاري",
    "المقيّم العقاري",
    "المكتب الهندسي",
    "أخصائي دراسة الحالة",
    "—",
  ].map((s) => s.trim()),
);

/**
 * True when the stored assignee name is usable for display (not blank, corrupted, or a role stub).
 */
export function isUsableAssigneeDisplayName(
  name: string | null | undefined,
): boolean {
  const t = (name ?? "").trim();
  if (!t) return false;
  if (GENERIC_ASSIGNEE_LABELS.has(t)) return false;
  if (looksLikeAssigneeIdCode(t)) return false;
  // Encoding corruption often lands as "???? ????"
  const nonSpace = t.replace(/\s+/g, "");
  if (!nonSpace) return false;
  const q = (nonSpace.match(/\?/g) ?? []).length;
  if (q > 0 && q / nonSpace.length >= 0.4) return false;
  if (/^[\uFFFD?.\-_/|·\s]+$/.test(t)) return false;
  return true;
}

/**
 * Prefer a real stored name; otherwise resolve from staff by distribution assignee id.
 */
export function resolveAssigneeDisplayName(input: {
  assigneeName?: string | null;
  assigneeId?: string | null;
  staffUsers: StaffUser[];
  fallback?: string;
}): string {
  if (isUsableAssigneeDisplayName(input.assigneeName)) {
    return input.assigneeName!.trim();
  }
  const key = input.assigneeId?.trim();
  if (key) {
    const staffName = buildAssigneeStaffIndex(input.staffUsers)
      .get(key)
      ?.name?.trim();
    if (staffName && isUsableAssigneeDisplayName(staffName)) return staffName;
    const known = ASSIGNEE_DISPLAY_FALLBACKS[key];
    if (known) return known;
  }
  const fb = input.fallback?.trim();
  if (fb && isUsableAssigneeDisplayName(fb)) return fb;
  return fb || "—";
}

export function resolvePartyCategory(
  assigneeId: string,
  rows: InspectorFeeRowDto[],
  staffUsers: StaffUser[],
): string {
  const row = rows.find((r) => r.assigneeId?.trim() === assigneeId.trim());
  if (row) return partyCategoryFromRow(row);
  const user = buildAssigneeStaffIndex(staffUsers).get(assigneeId.trim());
  if (user?.type === "external") return "المكاتب الهندسية";
  if (user?.role === "field-inspector") return "المعاينون";
  if (user?.role === "government-reviewer") return "المراجعون الحكوميون";
  return "—";
}

export function compareInspectorFeeRowsNewestFirst(
  a: InspectorFeeRowDto,
  b: InspectorFeeRowDto,
): number {
  const dateA =
    a.updatedAtUtc?.trim() ||
    a.workSubmittedAtUtc?.trim() ||
    a.poReceivedAtUtc?.trim() ||
    "";
  const dateB =
    b.updatedAtUtc?.trim() ||
    b.workSubmittedAtUtc?.trim() ||
    b.poReceivedAtUtc?.trim() ||
    "";
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  const poCmp = a.poNumber.trim().localeCompare(b.poNumber.trim(), "ar");
  if (poCmp !== 0) return poCmp;
  return a.propertyLabel.localeCompare(b.propertyLabel, "ar");
}

export function sortInspectorFeeRowsNewestFirst(
  rows: InspectorFeeRowDto[],
): InspectorFeeRowDto[] {
  return [...rows].sort(compareInspectorFeeRowsNewestFirst);
}

export function groupInspectorFeesByParty(
  rows: InspectorFeeRowDto[],
  staffUsers: StaffUser[],
): PartyFeeGroup[] {
  const map = new Map<string, InspectorFeeRowDto[]>();
  for (const row of rows) {
    const key = row.assigneeId?.trim() || "—";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([assigneeId, partyRows]) => ({
      assigneeId,
      name: resolvePartyName(assigneeId, staffUsers),
      category: resolvePartyCategory(assigneeId, partyRows, staffUsers),
      rows: sortInspectorFeeRowsNewestFirst(partyRows),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function formatFeeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ar-SA");
}

export const DISCOUNT_REASONS = [
  "تقصير في الرفع",
  "نقص مستندات",
  "تأخّر التسليم",
  "جودة دون المتفق",
] as const;

/** Reason presets for supervisor pricing edits on engineering-office fees. */
export const ENG_DISCOUNT_REASONS = [
  "تأخّر تسليم التقرير المساحي",
  "نقص في مرفقات الرفع المساحي",
  "مخالفة لمعايير الرفع الهندسي",
  "إعادة رفع بسبب أخطاء فنية",
] as const;
