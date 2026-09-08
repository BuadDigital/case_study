/** Shared ESG constants and types — filled by the appraiser in final review. */

import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";

export type SpecialistEsgGroup = {
  none: boolean;
  selected: string[];
  notes: string;
};

export type SpecialistEsgInputs = {
  esgEnv: SpecialistEsgGroup;
  esgSoc: SpecialistEsgGroup;
  esgGov: SpecialistEsgGroup;
};

export const ESG_ENV_FACTORS = [
  "كفاءة الطاقة",
  "أخطار الموقع والمناخ",
  "المباني الخضراء",
] as const;

export const ESG_SOC_FACTORS = [
  "جودة التصاميم ورفاهية المسكن",
  "الإسهام المجتمعي للعقار",
  "الخدمات المتوفرة في الموقع",
] as const;

export const ESG_GOV_FACTORS = [
  "الامتثال التنظيمي",
  "الإدارة الفعالة لبيانات العقار",
  "مقومات تشغيل العقار",
] as const;

export const ESG_NONE_NOTES = {
  env: "لا يوجد تأثير للعوامل البيئية على القيمة التقديرية للعقار.",
  soc: "لا يوجد تأثير للعوامل الاجتماعية على القيمة التقديرية للعقار.",
  gov: "لا يوجد تأثير لعوامل الحوكمة على القيمة التقديرية للعقار.",
} as const;

export const VALUATION_SPECIALIST_ESG_CHANGED_EVENT =
  "ejadah-valuation-specialist-esg-changed";

export function emptySpecialistEsgGroup(noneNotes: string): SpecialistEsgGroup {
  return { none: true, selected: [], notes: noneNotes };
}

export function emptySpecialistEsgInputs(): SpecialistEsgInputs {
  return {
    esgEnv: emptySpecialistEsgGroup(ESG_NONE_NOTES.env),
    esgSoc: emptySpecialistEsgGroup(ESG_NONE_NOTES.soc),
    esgGov: emptySpecialistEsgGroup(ESG_NONE_NOTES.gov),
  };
}

function normalizeGroup(
  raw: unknown,
  noneNotes: string,
): SpecialistEsgGroup {
  if (!raw || typeof raw !== "object") {
    return emptySpecialistEsgGroup(noneNotes);
  }
  const g = raw as Partial<SpecialistEsgGroup>;
  const none = g.none !== false;
  const notes =
    typeof g.notes === "string" && g.notes.trim()
      ? g.notes
      : none
        ? noneNotes
        : "";
  return {
    none,
    selected: Array.isArray(g.selected)
      ? g.selected.filter((x): x is string => typeof x === "string")
      : [],
    notes,
  };
}

function normalizeInputs(raw: unknown): SpecialistEsgInputs {
  const fallback = emptySpecialistEsgInputs();
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Partial<SpecialistEsgInputs>;
  return {
    esgEnv: normalizeGroup(row.esgEnv, ESG_NONE_NOTES.env),
    esgSoc: normalizeGroup(row.esgSoc, ESG_NONE_NOTES.soc),
    esgGov: normalizeGroup(row.esgGov, ESG_NONE_NOTES.gov),
  };
}

export function loadSpecialistEsgInputs(
  propertyId: string | null | undefined,
): SpecialistEsgInputs {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return emptySpecialistEsgInputs();
  return normalizeInputs(loadSpecialistReportExtrasBag(id).esg);
}

export function saveSpecialistEsgInputs(
  propertyId: string,
  inputs: SpecialistEsgInputs,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  patchSpecialistReportExtras(id, { esg: inputs });
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_ESG_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}
