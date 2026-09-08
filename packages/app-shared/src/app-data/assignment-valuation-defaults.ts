/** Valuation purpose and basis of value — same backend keys (ValuationPurposeKeys / BasisOfValueKeys). */

import { NABR_SEED_CLIENT_ID } from "@platform/api-client";

export type ValuationSelectOption = { value: string; label: string };

export const VALUATION_PURPOSE_OPTIONS: ValuationSelectOption[] = [
  { value: "auction_liquidation", label: "البيع بالمزاد العلني لغرض التصفية" },
  { value: "estate_liquidation", label: "تصفية التركات" },
  { value: "sale", label: "البيع" },
  { value: "purchase", label: "الشراء" },
  { value: "financing", label: "التمويل والرهن العقاري" },
  { value: "financial_reporting", label: "التقارير المالية" },
  { value: "litigation", label: "التقاضي وفض النزاعات" },
  { value: "expropriation", label: "نزع الملكية للمنفعة العامة" },
  { value: "judicial_execution", label: "تنفيذ قضائي" },
  { value: "sale_purchase", label: "بيع أو شراء" },
  { value: "other", label: "أخرى" },
];

export const VALUE_BASIS_OPTIONS: ValuationSelectOption[] = [
  { value: "market", label: "القيمة السوقية" },
  { value: "market_rent", label: "الإيجار السوقي" },
  { value: "equitable", label: "القيمة المنصفة" },
  { value: "investment", label: "القيمة الاستثمارية" },
  { value: "synergistic", label: "القيمة التكاملية" },
  { value: "liquidation", label: "قيمة التصفية" },
  { value: "fair_ifrs", label: "القيمة العادلة (IFRS)" },
  { value: "fair_statutory", label: "القيمة العادلة (القانونية/التشريعية)" },
];

export const VALUE_PREMISE_OPTIONS: ValuationSelectOption[] = [
  { value: "hau", label: "أعلى وأفضل استخدام" },
  { value: "current", label: "الاستخدام الحالي" },
  { value: "orderly", label: "التصفية المنظمة" },
  { value: "forced", label: "البيع القسري" },
];

export function isPrivateAssignment(type: string | null | undefined): boolean {
  const t = (type ?? "").trim();
  return t === "قطاع خاص" || t === "خاص";
}

export function isNabrClientId(id: string | null | undefined): boolean {
  return (id ?? "").trim().toLowerCase() === NABR_SEED_CLIENT_ID;
}

/**
 * Private: sale / market value (including Enfath + Nabr).
 * Execution / estates: liquidation auction / liquidation value.
 */
export function usesNabrSaleMarketDefaults(
  assignmentType: string | null | undefined,
  _subClientId?: string | null,
): boolean {
  return isPrivateAssignment(assignmentType);
}

export function valuationPurposeKeyForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  return usesNabrSaleMarketDefaults(type, subClientId)
    ? "sale"
    : "auction_liquidation";
}

export function basisOfValueKeyForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  return usesNabrSaleMarketDefaults(type, subClientId)
    ? "market"
    : "liquidation";
}

export function valuationPurposeLabelArForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  return usesNabrSaleMarketDefaults(type, subClientId)
    ? "البيع"
    : "البيع بالمزاد العلني لغرض التصفية";
}

export function basisOfValueLabelArForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  return usesNabrSaleMarketDefaults(type, subClientId)
    ? "القيمة السوقية"
    : "قيمة التصفية";
}

export function defaultPremiseKeyForBasis(valueBasisKey: string): string {
  return valueBasisKey === "liquidation" ? "orderly" : "current";
}

export function isPremiseCompatibleWithBasis(
  basisKey: string,
  premiseKey: string,
): boolean {
  if (!premiseKey.trim()) return true;
  const liquidation = basisKey.trim() === "liquidation";
  return liquidation
    ? premiseKey === "orderly" || premiseKey === "forced"
    : premiseKey === "hau" || premiseKey === "current";
}

export function coercePremiseForBasis(
  basisKey: string,
  premiseKey: string,
): string {
  if (isPremiseCompatibleWithBasis(basisKey, premiseKey) && premiseKey.trim()) {
    return premiseKey;
  }
  return defaultPremiseKeyForBasis(basisKey);
}

/** Choosing HBU/current use leaves liquidation; orderly/forced requires it. */
export function basisKeyForPremise(
  premiseKey: string,
  currentBasisKey: string,
): string {
  if (premiseKey === "orderly" || premiseKey === "forced") {
    return "liquidation";
  }
  if (premiseKey === "hau" || premiseKey === "current") {
    return currentBasisKey === "liquidation" ? "market" : currentBasisKey;
  }
  return currentBasisKey;
}

export function premiseOptionsForBasis(basisKey: string): ValuationSelectOption[] {
  const allowed = new Set(
    basisKey === "liquidation" ? ["orderly", "forced"] : ["hau", "current"],
  );
  return VALUE_PREMISE_OPTIONS.filter((o) => allowed.has(o.value));
}

export function assignmentValuationDefaults(
  type: string | null | undefined,
  subClientId?: string | null,
): { purposeKey: string; basisKey: string; premiseKey: string } {
  const purposeKey = valuationPurposeKeyForAssignment(type, subClientId);
  const basisKey = basisOfValueKeyForAssignment(type, subClientId);
  return {
    purposeKey,
    basisKey,
    premiseKey: valuePremiseKeyForAssignment(type, subClientId),
  };
}

export function resolveAssignmentValuationKeys(
  type: string | null | undefined,
  keys?: {
    purposeKey?: string | null;
    basisKey?: string | null;
    premiseKey?: string | null;
  },
  subClientId?: string | null,
): { purposeKey: string; basisKey: string; premiseKey: string } {
  if (!(type ?? "").trim()) {
    return {
      purposeKey: keys?.purposeKey?.trim() || "",
      basisKey: keys?.basisKey?.trim() || "",
      premiseKey: keys?.premiseKey?.trim() || "",
    };
  }
  const defaults = assignmentValuationDefaults(type, subClientId);
  const purposeKey = keys?.purposeKey?.trim() || defaults.purposeKey;
  const basisKey = keys?.basisKey?.trim() || defaults.basisKey;
  return {
    purposeKey,
    basisKey,
    premiseKey: coercePremiseForBasis(
      basisKey,
      keys?.premiseKey?.trim() || defaults.premiseKey,
    ),
  };
}

export function valuePremiseKeyForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  return defaultPremiseKeyForBasis(basisOfValueKeyForAssignment(type, subClientId));
}

export function valuePremiseLabelArForAssignment(
  type: string | null | undefined,
  subClientId?: string | null,
): string {
  const key = valuePremiseKeyForAssignment(type, subClientId);
  return VALUE_PREMISE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}
