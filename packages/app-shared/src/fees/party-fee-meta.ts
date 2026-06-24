import type { InspectorFeeRowDto } from "@platform/api-client";
import type { StaffUser } from "../prototype/constants";

const TASK_KIND_CATEGORY: Record<string, string> = {
  "field-inspection": "المعاينون",
  "engineering-survey": "المكاتب الهندسية",
  "government-review": "المراجعون الحكوميون",
};

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
  return buildAssigneeStaffIndex(staffUsers).get(key)?.name ?? key;
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
      rows: partyRows,
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
