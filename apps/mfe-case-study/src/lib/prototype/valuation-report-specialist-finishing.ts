/** Building finishing level filled by the case specialist — mirrored to the appraiser draft for print. */

export type SpecialistFinishingLevel =
  | ""
  | "luxury"
  | "medium"
  | "ordinary"
  | "none";

const STORAGE_PREFIX = "ejadah.valuation-specialist-finishing.v1:";

export const VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT =
  "ejadah-valuation-specialist-finishing-changed";

function storageKey(propertyId: string): string {
  return `${STORAGE_PREFIX}${propertyId.trim()}`;
}

export function normalizeSpecialistFinishingLevel(
  raw: string | null | undefined,
): SpecialistFinishingLevel {
  const v = (raw ?? "").trim();
  if (
    v === "luxury" ||
    v === "medium" ||
    v === "ordinary" ||
    v === "none"
  ) {
    return v;
  }
  return "";
}

export function loadSpecialistFinishingLevel(
  propertyId: string | null | undefined,
): SpecialistFinishingLevel {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return "";
  try {
    return normalizeSpecialistFinishingLevel(
      window.localStorage.getItem(storageKey(id)),
    );
  } catch {
    return "";
  }
}

export function saveSpecialistFinishingLevel(
  propertyId: string,
  level: SpecialistFinishingLevel,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  const next = normalizeSpecialistFinishingLevel(level);
  if (next) window.localStorage.setItem(storageKey(id), next);
  else window.localStorage.removeItem(storageKey(id));
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}

export function specialistFinishingLevelLabel(
  key: SpecialistFinishingLevel,
): string {
  switch (key) {
    case "luxury":
      return "تشطيب فاخر";
    case "medium":
      return "تشطيب متوسط";
    case "ordinary":
      return "تشطيب عادي";
    case "none":
      return "بدون تشطيب";
    default:
      return "";
  }
}
