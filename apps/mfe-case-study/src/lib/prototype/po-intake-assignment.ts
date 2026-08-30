/** PO intake — assignment types, Infath/Nabr clients, valuation defaults, court path. */

import {
  basisOfValueKeyForAssignment,
  basisOfValueLabelArForAssignment,
  valuationPurposeKeyForAssignment,
  valuationPurposeLabelArForAssignment,
  valuePremiseKeyForAssignment,
  valuePremiseLabelArForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { getCachedOrganizationSla } from "@platform/app-shared/organization/organization-settings-cache";
import {
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
} from "@platform/api-client";

export function formatPoDisplay(poNumber: string): string {
  const n = poNumber.trim();
  if (!n) return "";
  if (/^PO[-\s]/i.test(n)) return n;
  return `PO-${n}`;
}

export const ASSIGNMENT_TYPE_OPTIONS = [
  "تنفيذ",
  "تركات",
  "قطاع خاص",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPE_OPTIONS)[number];

/** Primary classification on the work order (spec v2). */
export const ASSIGNMENT_PRIMARY_OPTIONS = ["تنفيذ", "خاص"] as const;
export type AssignmentPrimary = (typeof ASSIGNMENT_PRIMARY_OPTIONS)[number];

/** Subtype shown in the UI — stored as AssignmentType. */
export type AssignmentSecondary = "تنفيذ" | "تركات" | "خاص";

export function assignmentPrimary(type: AssignmentType): AssignmentPrimary {
  return type === "قطاع خاص" ? "خاص" : "تنفيذ";
}

export function assignmentSecondary(type: AssignmentType): AssignmentSecondary {
  if (type === "تركات") return "تركات";
  if (type === "قطاع خاص") return "خاص";
  return "تنفيذ";
}

export function assignmentCompositeTag(type: AssignmentType): string {
  return `${assignmentPrimary(type)} / ${assignmentSecondary(type)}`;
}

export function secondaryOptionsForPrimary(
  primary: AssignmentPrimary,
): AssignmentSecondary[] {
  return primary === "خاص" ? ["خاص"] : ["تنفيذ", "تركات"];
}

export function assignmentTypeFromParts(
  primary: AssignmentPrimary,
  secondary: AssignmentSecondary,
): AssignmentType {
  if (primary === "خاص" || secondary === "خاص") return "قطاع خاص";
  if (secondary === "تركات") return "تركات";
  return "تنفيذ";
}

/** Infath + private: Nabr is the sub-client and extra report user. */
export function showsValuationReportUserField(
  type: AssignmentType | "",
  clientId: string,
): boolean {
  return (
    isInfathClient(clientId) &&
    type !== "" &&
    assignmentPrimary(type) === "خاص"
  );
}

export function isInfathClient(clientId: string): boolean {
  return clientId.trim() === INFATH_SEED_CLIENT_ID;
}

export function isNabrClient(clientId: string): boolean {
  return clientId.trim() === NABR_SEED_CLIENT_ID;
}

/** Nabr is Infath's sub-client for now — not a peer work-order client. */
export function isSelectableWorkOrderClient(
  clientId: string,
  currentClientId = "",
): boolean {
  return !isNabrClient(clientId) || clientId === currentClientId;
}

/** Infath's known sub-client. Direct-Nabr-as-peer-client is deferred. */
export const INFATH_SUB_CLIENT_IDS = [NABR_SEED_CLIENT_ID] as const;

export function showsSubClientField(
  type: AssignmentType | "",
  clientId: string,
): boolean {
  return showsValuationReportUserField(type, clientId);
}

export function defaultSubClientId(): string {
  return NABR_SEED_CLIENT_ID;
}

export function subClientIdFromReportUsers(
  reportUserClientIds: string[] | undefined,
): string {
  const match = (reportUserClientIds ?? []).find((id) =>
    (INFATH_SUB_CLIENT_IDS as readonly string[]).includes(id),
  );
  return match ?? defaultSubClientId();
}

export const VALUATION_REPORT_USER_OPTION_LABEL =
  "مركز الإسناد والتصفية (إنفاذ) و شركة نبر العقارية";

/**
 * Infath + enforcement → none (report is Infath alone).
 * Infath + private → Nabr (usage: Infath client + Nabr report user).
 */
export function reportUserClientIdsForAssignment(
  type: AssignmentType | "",
  clientId: string,
  subClientId: string = NABR_SEED_CLIENT_ID,
): string[] {
  if (!showsValuationReportUserField(type, clientId)) return [];
  return [subClientId.trim() || NABR_SEED_CLIENT_ID];
}

export const VALUATION_PURPOSE_AUCTION_LIQUIDATION =
  "البيع بالمزاد العلني لغرض التصفية";
export const VALUATION_PURPOSE_SALE = "البيع";
export const VALUE_BASIS_MARKET = "القيمة السوقية";
export const VALUE_BASIS_LIQUIDATION = "قيمة التصفية";

export function valuationPurposeForAssignment(
  type: AssignmentType,
  subClientId?: string,
): {
  key: string;
  label: string;
} {
  return {
    key: valuationPurposeKeyForAssignment(type, subClientId),
    label: valuationPurposeLabelArForAssignment(type, subClientId),
  };
}

export function basisOfValueForAssignment(
  type: AssignmentType,
  subClientId?: string,
): {
  key: string;
  label: string;
} {
  return {
    key: basisOfValueKeyForAssignment(type, subClientId),
    label: basisOfValueLabelArForAssignment(type, subClientId),
  };
}

export function valuePremiseForAssignment(
  type: AssignmentType,
  subClientId?: string,
): {
  key: string;
  label: string;
} {
  return {
    key: valuePremiseKeyForAssignment(type, subClientId),
    label: valuePremiseLabelArForAssignment(type, subClientId),
  };
}

/** Court path: request number + court/circuit + assignment decision + visits/keys. */
export function isCourtAssignmentPath(type: AssignmentType): boolean {
  return type === "تنفيذ";
}

export function requiresAssignmentDecree(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

/** Court and circuit — execution path only. */
export function showsCourtFields(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

export function requiresRequestNumberField(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

/** Contact officer required for execution and estates; optional for private sector. */
export function requiresContacts(type: AssignmentType): boolean {
  return type !== "قطاع خاص";
}

export function businessDaysForAssignmentType(type: AssignmentType): number {
  // Defaults 4/10; overridden by OrganizationSettings when the cache is warm.
  const sla = getCachedOrganizationSla();
  return type === "قطاع خاص"
    ? Math.max(1, sla.privateSectorBusinessDays)
    : Math.max(1, sla.defaultBusinessDays);
}

/** Mock courts and circuits — replace with supervisor-managed list. */
export const COURTS_BY_CITY: Record<
  string,
  { court: string; circuits: string[] }[]
> = {
  "مكة المكرمة": [
    {
      court: "محكمة التنفيذ بمكة المكرمة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
    {
      court: "محكمة الاستئناف بمكة المكرمة",
      circuits: ["دائرة الأحوال"],
    },
  ],
  جدة: [
    {
      court: "محكمة التنفيذ بجدة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"],
    },
  ],
  الرياض: [
    {
      court: "محكمة التنفيذ بالرياض",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
  ],
  الطائف: [
    { court: "محكمة التنفيذ بالطائف", circuits: ["الدائرة الأولى"] },
  ],
};
