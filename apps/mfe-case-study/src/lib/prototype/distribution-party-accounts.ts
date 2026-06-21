import type { RoleId } from "@platform/types";

export type DistributionAssignee = {
  id: string;
  name: string;
  subtitle?: string;
};

export type DistributionPartyAccount = {
  assigneeId: string;
  name: string;
  subtitle: string;
  roleId: RoleId;
  email: string;
  password: string;
  roleOptionGroup: string;
  roleOptionLabel: string;
  enabled?: boolean;
};

export const DISTRIBUTION_PARTY_ACCOUNTS: DistributionPartyAccount[] = [
  {
    assigneeId: "gov-firas",
    name: "فراس كمرين",
    subtitle: "مراجع حكومي — زيارة المحكمة وجمع المفاتيح",
    roleId: "government-reviewer",
    email: "feras@ejadah.dev",
    password: "EjadaCD2025!",
    roleOptionGroup: "قسم دراسة الحالة",
    roleOptionLabel: "فراس كمرين — مراجع حكومي",
    enabled: true,
  },
  {
    assigneeId: "vc-mohammed-diab",
    name: "محمد دياب",
    subtitle: "منسق عمليات التقييم",
    roleId: "valuation-coordinator",
    email: "valuation@ejadah.dev",
    password: "EjadaVC2025!",
    roleOptionGroup: "قسم التقييم العقاري",
    roleOptionLabel: "محمد دياب — منسق عمليات التقييم",
    enabled: true,
  },
  {
    assigneeId: "fi-ahmed",
    name: "أحمد سعيد",
    subtitle: "معاين ميداني — متعاون",
    roleId: "field-inspector",
    email: "ahmed@ejadah.dev",
    password: "EjadaFI2025!",
    roleOptionGroup: "قسم التقييم العقاري",
    roleOptionLabel: "أحمد سعيد — معاين ميداني (متعاون)",
    enabled: true,
  },
  {
    assigneeId: "fi-abdullah-abdulmane",
    name: "عبدالله عبدالمانع",
    subtitle: "معاين ميداني — دوام كامل",
    roleId: "field-inspector",
    email: "abdullah.abdulmane@ejadah.dev",
    password: "EjadaFI2025!",
    roleOptionGroup: "قسم التقييم العقاري",
    roleOptionLabel: "عبدالله عبدالمانع — معاين ميداني",
    enabled: true,
  },
  {
    assigneeId: "val-abdullah",
    name: "عبدالله الكثيري",
    subtitle: "مقيم عقاري",
    roleId: "real-estate-appraiser",
    email: "abdullah.kathiri@ejadah.dev",
    password: "EjadaRA2025!",
    roleOptionGroup: "قسم التقييم العقاري",
    roleOptionLabel: "عبدالله الكثيري — مقيم عقاري",
    enabled: true,
  },
  {
    assigneeId: "eo-jeddah",
    name: "مكتب جدة للمساحة",
    subtitle: "رفع مساحي",
    roleId: "engineering-office",
    email: "survey.jeddah@ejadah.dev",
    password: "EjadaEO2025!",
    roleOptionGroup: "الرفع المساحي",
    roleOptionLabel: "مكتب جدة للمساحة — مكتب هندسي",
    enabled: true,
  },
];

const REVIEWER_CITY_COVERAGE: Record<string, string[]> = {
  "gov-firas": ["الرياض", "الطائف"],
};

function enabledAccounts(): DistributionPartyAccount[] {
  return DISTRIBUTION_PARTY_ACCOUNTS.filter((a) => a.enabled !== false);
}

function toAssignee(account: DistributionPartyAccount): DistributionAssignee {
  return {
    id: account.assigneeId,
    name: account.name,
    subtitle: account.subtitle,
  };
}

export function getDistributionPartyAccounts(): DistributionPartyAccount[] {
  return enabledAccounts();
}

export function getReviewerCityCoverage(assigneeId: string): string[] {
  return REVIEWER_CITY_COVERAGE[assigneeId] ?? [];
}

export function getGovernmentAuditors(): DistributionAssignee[] {
  return enabledAccounts()
    .filter((a) => a.roleId === "government-reviewer")
    .map(toAssignee);
}

export function getValuationCoordinators(): DistributionAssignee[] {
  return enabledAccounts()
    .filter((a) => a.roleId === "valuation-coordinator")
    .map(toAssignee);
}

export function getFieldInspectors(): DistributionAssignee[] {
  return enabledAccounts()
    .filter((a) => a.roleId === "field-inspector")
    .map(toAssignee);
}

export function getValuators(): DistributionAssignee[] {
  return enabledAccounts()
    .filter((a) => a.roleId === "real-estate-appraiser")
    .map(toAssignee);
}

export function getEngineeringOffices(): DistributionAssignee[] {
  return enabledAccounts()
    .filter((a) => a.roleId === "engineering-office")
    .map(toAssignee);
}

export function getPrototypeRoleAssigneeId(): Partial<Record<RoleId, string>> {
  const map: Partial<Record<RoleId, string>> = {};
  for (const account of enabledAccounts()) {
    if (!map[account.roleId]) map[account.roleId] = account.assigneeId;
  }
  return map;
}

export function partyAccountByAssigneeId(
  assigneeId: string,
): DistributionPartyAccount | undefined {
  return enabledAccounts().find((a) => a.assigneeId === assigneeId);
}

export function partyAccountByEmail(
  email: string,
): DistributionPartyAccount | undefined {
  const key = email.trim().toLowerCase();
  return enabledAccounts().find((a) => a.email.trim().toLowerCase() === key);
}

export function partyAccountForRole(
  roleId: RoleId,
): DistributionPartyAccount | undefined {
  const expectedId = getPrototypeRoleAssigneeId()[roleId];
  if (!expectedId) return undefined;
  return partyAccountByAssigneeId(expectedId);
}

export function partyAccountForViewer(
  roleId: RoleId,
  viewerEmail?: string | null,
): DistributionPartyAccount | undefined {
  if (viewerEmail) {
    const byEmail = partyAccountByEmail(viewerEmail);
    if (byEmail?.roleId === roleId) return byEmail;
  }
  return partyAccountForRole(roleId);
}
