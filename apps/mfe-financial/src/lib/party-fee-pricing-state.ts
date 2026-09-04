/**
 * Pure rules behind `FinancePartyFeePricing` — the party categories, the empty
 * draft per category, tier renumbering and the table pick after a reload.
 * No React, no I/O.
 */
import type {
  PartyFeePricingCategory,
  PartyFeePricingDto,
  PartyFeePricingTableSummaryDto,
  PartyFeePricingTierDto,
} from "@platform/api-client";
import {
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
  type DistributionAssignee,
} from "@case-study/mfe/lib/distribution-assignees";

export const PRICING_STALE_MS = 60_000;

export const PRICING_ICON = "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";

export const EMPTY_STAFF_USERS: Parameters<typeof getEngineeringOffices>[0] = [];
export const EMPTY_TABLES: PartyFeePricingTableSummaryDto[] = [];

export const CATEGORIES: {
  id: PartyFeePricingCategory;
  label: string;
  hint: string;
  partyLabel: string;
}[] = [
  {
    id: "engineering-survey",
    label: "المكاتب الهندسية",
    hint: "شرائح المساحة والأتعاب",
    partyLabel: "المكاتب",
  },
  {
    id: "court-visit",
    label: "زيارات المحكمة",
    hint: "أتعاب الزيارة للمراجع المتعاون",
    partyLabel: "المراجعون",
  },
  {
    id: "field-inspector",
    label: "المعاينين الميدانيين",
    hint: "متعاون فرد أو منشأة",
    partyLabel: "المعاينون",
  },
];

export function partiesForCategory(
  category: PartyFeePricingCategory,
  staffUsers: Parameters<typeof getEngineeringOffices>[0],
): DistributionAssignee[] {
  if (category === "engineering-survey") return getEngineeringOffices(staffUsers);
  if (category === "court-visit") return getGovernmentAuditors(staffUsers);
  return getFieldInspectors(staffUsers);
}

export function emptyDraft(
  category: PartyFeePricingCategory,
  partial?: Partial<PartyFeePricingDto>,
): PartyFeePricingDto {
  return {
    id: "",
    category,
    name: "",
    isActive: false,
    assignedCount: 0,
    assignedAssigneeIds: [],
    areaTiers:
      category === "engineering-survey"
        ? [
            { sortOrder: 0, maxAreaM2: 500, feeSar: 0 },
            { sortOrder: 1, maxAreaM2: null, feeSar: 0 },
          ]
        : [],
    courtVisitFeeSar: 0,
    fieldInspectorIndividualFeeSar: 0,
    fieldInspectorOrganizationFeeSar: 0,
    ...partial,
  };
}

export function num(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function reindexTiers(tiers: PartyFeePricingTierDto[]): PartyFeePricingTierDto[] {
  return tiers.map((t, i) => ({
    ...t,
    sortOrder: i,
    maxAreaM2: i === tiers.length - 1 ? null : t.maxAreaM2,
  }));
}

export function tierFromValue(tiers: PartyFeePricingTierDto[], index: number): number {
  if (index === 0) return 0;
  const prev = tiers[index - 1]?.maxAreaM2;
  if (prev == null || prev <= 0) return 0;
  return prev;
}

export function defaultTableName(count: number): string {
  return count === 0 ? "افتراضي" : `جدول ${count + 1}`;
}

export function pickTableId(
  list: PartyFeePricingTableSummaryDto[],
  preferId?: string,
): string {
  return preferId && list.some((t) => t.id === preferId)
    ? preferId
    : (list.find((t) => t.isActive)?.id ?? list[0]?.id ?? "");
}
