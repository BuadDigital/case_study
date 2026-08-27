/** ESG inputs filled by the case specialist — mirrored read-only to the appraiser. */

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

const STORAGE_PREFIX = "ejadah.valuation-specialist-esg.v1:";

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

function specialistEsgStorageKey(propertyId: string): string {
  return `${STORAGE_PREFIX}${propertyId.trim()}`;
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

export function loadSpecialistEsgInputs(
  propertyId: string | null | undefined,
): SpecialistEsgInputs {
  const id = (propertyId ?? "").trim();
  const fallback = emptySpecialistEsgInputs();
  if (!id || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(specialistEsgStorageKey(id));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return fallback;
    const row = parsed as Partial<SpecialistEsgInputs>;
    return {
      esgEnv: normalizeGroup(row.esgEnv, ESG_NONE_NOTES.env),
      esgSoc: normalizeGroup(row.esgSoc, ESG_NONE_NOTES.soc),
      esgGov: normalizeGroup(row.esgGov, ESG_NONE_NOTES.gov),
    };
  } catch {
    return fallback;
  }
}

export function saveSpecialistEsgInputs(
  propertyId: string,
  inputs: SpecialistEsgInputs,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  window.localStorage.setItem(specialistEsgStorageKey(id), JSON.stringify(inputs));
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_ESG_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}
