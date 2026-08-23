/** الغرض من التقييم وأساس القيمة — نفس مفاتيح الـ backend (ValuationPurposeKeys / BasisOfValueKeys). */

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
 * خاص: بيع / قيمة سوقية (بما فيها إنفاذ + نبر).
 * تنفيذ / تركات: مزاد تصفية / قيمة تصفية.
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
