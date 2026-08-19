/** الغرض من التقييم وأساس القيمة — نفس مفاتيح الـ backend (ValuationPurposeKeys / BasisOfValueKeys). */

import { NABR_SEED_CLIENT_ID } from "@platform/api-client";

export type ValuationSelectOption = { value: string; label: string };

export const VALUATION_PURPOSE_OPTIONS: ValuationSelectOption[] = [
  { value: "auction_liquidation", label: "البيع بالمزاد العلني لغرض التصفية" },
  { value: "sale", label: "البيع" },
  { value: "judicial_execution", label: "تنفيذ قضائي" },
  { value: "sale_purchase", label: "بيع أو شراء" },
  { value: "financing", label: "تمويل ورهن" },
  { value: "financial_reporting", label: "قوائم مالية" },
  { value: "litigation", label: "نزاع قضائي" },
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

export function isPrivateAssignment(type: string | null | undefined): boolean {
  const t = (type ?? "").trim();
  return t === "قطاع خاص" || t === "خاص";
}

export function isNabrClientId(id: string | null | undefined): boolean {
  return (id ?? "").trim().toLowerCase() === NABR_SEED_CLIENT_ID;
}

/**
 * Infath + Nabr (خاص): بيع / قيمة سوقية.
 * تنفيذ بدون نبر: مزاد تصفية / قيمة تصفية.
 */
export function usesNabrSaleMarketDefaults(
  assignmentType: string | null | undefined,
  subClientId?: string | null,
): boolean {
  if (!isPrivateAssignment(assignmentType)) return false;
  const sub = (subClientId ?? "").trim();
  return !sub || isNabrClientId(sub);
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
