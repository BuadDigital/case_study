import type { StaffUser } from "@platform/app-shared/prototype/constants";
import type { RoleId } from "@platform/types";
import {
  isStaffAssignable,
  partyRoleForStaffUser,
  type DistributionAssignee,
} from "../distribution-assignees";

/** Party roles that can receive an operations task (execution sides). */
const EXECUTION_PARTY_ORDER: RoleId[] = [
  "field-inspector",
  "real-estate-appraiser",
  "engineering-office",
  "government-reviewer",
];

const GROUP_LABELS: Record<string, string> = {
  "field-inspector": "معاين ميداني",
  "real-estate-appraiser": "مقيم عقاري",
  "engineering-office": "مكتب هندسي",
  "government-reviewer": "مراجع حكومي",
  other: "أطراف أخرى",
};

const EXECUTION_SET = new Set<string>(EXECUTION_PARTY_ORDER);

function uniqueById(list: DistributionAssignee[]): DistributionAssignee[] {
  const seen = new Set<string>();
  const out: DistributionAssignee[] = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function toAssignee(user: StaffUser): DistributionAssignee {
  return {
    id: user.distributionAssigneeId!.trim(),
    name: user.name,
    subtitle: user.role,
  };
}

/** Every active staff row that has a distribution id (last-resort list). */
function allDistributionAssignees(staffUsers: StaffUser[]): DistributionAssignee[] {
  return staffUsers
    .filter(isStaffAssignable)
    .map(toAssignee)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function executionPartyAssignees(staffUsers: StaffUser[]): DistributionAssignee[] {
  const byRole = new Map<RoleId, DistributionAssignee[]>();
  for (const role of EXECUTION_PARTY_ORDER) byRole.set(role, []);

  for (const u of staffUsers) {
    if (!isStaffAssignable(u)) continue;
    const role = partyRoleForStaffUser(u);
    if (!role || !EXECUTION_SET.has(role)) continue;
    byRole.get(role as RoleId)!.push(toAssignee(u));
  }

  const ordered: DistributionAssignee[] = [];
  for (const role of EXECUTION_PARTY_ORDER) {
    const items = byRole.get(role) ?? [];
    items.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    ordered.push(...items);
  }
  return uniqueById(ordered);
}

/**
 * Who may appear in «مُسندة إلى» for an operations task type.
 * - court_visit → government reviewers only (visit fee path)
 * - general → field inspector, appraiser, engineering office, government reviewer
 */
export function assigneesForOperationsTaskType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  if (type === "court_visit") {
    const gov = staffUsers
      .filter(
        (u) =>
          isStaffAssignable(u) &&
          partyRoleForStaffUser(u) === "government-reviewer",
      )
      .map(toAssignee)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return gov.length > 0 ? gov : allDistributionAssignees(staffUsers);
  }

  if (type === "reshoot" || type === "field_visit") {
    const inspec = staffUsers
      .filter(
        (u) =>
          isStaffAssignable(u) &&
          partyRoleForStaffUser(u) === "field-inspector",
      )
      .map(toAssignee)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return inspec.length > 0 ? inspec : allDistributionAssignees(staffUsers);
  }

  // general: execution parties; if role mapping empty, show everyone with a dist id
  const parties = executionPartyAssignees(staffUsers);
  if (parties.length > 0) return parties;
  return allDistributionAssignees(staffUsers);
}

export type AssigneeOptGroup = {
  key: string;
  label: string;
  items: DistributionAssignee[];
};

/** Group assignees for the create/reassign <select> (`optgroup`). */
export function groupAssigneesForSelect(
  assignees: DistributionAssignee[],
  staffUsers: StaffUser[],
): AssigneeOptGroup[] {
  const byRole = new Map<string, DistributionAssignee[]>();

  for (const a of assignees) {
    const user = staffUsers.find(
      (u) => u.distributionAssigneeId?.trim() === a.id,
    );
    const role = user ? partyRoleForStaffUser(user) : null;
    const key =
      role && EXECUTION_PARTY_ORDER.includes(role) ? role : "other";
    const bucket = byRole.get(key) ?? [];
    bucket.push(a);
    byRole.set(key, bucket);
  }

  const groups: AssigneeOptGroup[] = [];
  for (const role of EXECUTION_PARTY_ORDER) {
    const items = byRole.get(role);
    if (!items?.length) continue;
    groups.push({
      key: role,
      label: GROUP_LABELS[role] ?? role,
      items,
    });
  }
  const other = byRole.get("other");
  if (other?.length) {
    groups.push({
      key: "other",
      label: GROUP_LABELS.other,
      items: other,
    });
  }
  return groups;
}
