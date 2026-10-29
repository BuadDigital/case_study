/**
 * What the bourse inquiry already answered for the inspector's «خصائص العقار», and where it came from.
 *
 *  - «الأصل محل التقييم» ← the property type the specialist chose in the bourse (فيلا، أرض …)
 *  - «استخدام العقار»    ← the property classification from the same step (مبنى مفرد، أرض …)
 *  - «حالة منطقة العقار» ← the deed status, when it names the zone
 *
 * The values are copied into every EMPTY field — also after the inspector has started — and never over
 * something he wrote. A field still holding exactly the copied value carries a source note
 * («المصدر: استعلام البورصة»); once he changes it the note goes.
 */
import {
  ALL_PROPERTY_TYPES,
  INSPECTOR_FEATURE_FIELDS,
  PROPERTY_CLASSIFICATIONS,
  classificationForPropertyType,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";
import type { PoPropertyIntake } from "./po-intake-data";

export const BOURSE_SOURCE_NOTE = "المصدر: استعلام البورصة";

type BourseSource = Pick<PoPropertyIntake, "classification" | "propertyType" | "deedStatus"> &
  Partial<Pick<PoPropertyIntake, "bourseCompletedByName" | "bourseCompletedAtUtc">>;

function shortDate(iso: string | undefined): string {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA").replace(/-/g, "/");
}

/** «المصدر: استعلام البورصة — أدخله {الاسم} · {التاريخ}» — name and date only when the server recorded them. */
function bourseSourceNote(property: BourseSource | null | undefined): string {
  const by = property?.bourseCompletedByName?.trim() ?? "";
  const on = shortDate(property?.bourseCompletedAtUtc);
  const who = by ? ` — أدخله ${by}` : "";
  return `${BOURSE_SOURCE_NOTE}${who}${on ? ` · ${on}` : ""}`;
}

/**
 * The property type as one of the inspector's «الأصل محل التقييم» options, "" when none fits.
 * How it works: the bourse type itself when it is in the system's list (the inspector's options since
 * 2026-10-29), else a keyword match onto a catalogue name for legacy free-text types.
 */
function mapPropertyTypeToAssetSubject(propertyType: string): string {
  const t = propertyType.trim();
  if (!t) return "";
  if (ALL_PROPERTY_TYPES.includes(t)) return t;
  const lower = t.toLowerCase();
  if (lower.includes("فيلا") || lower.includes("villa")) return "فيلا";
  if (lower.includes("أرض") || lower.includes("ارض") || lower.includes("land")) return "أرض سكنية";
  if (lower.includes("شقة") || lower.includes("apartment")) return "شقة سكنية";
  if (lower.includes("عمارة") || lower.includes("building")) return "عمارة";
  if (lower.includes("محل") || lower.includes("تجار")) return "محل تجاري";
  if (lower.includes("مستودع") || lower.includes("warehouse")) return "مستودع";
  return "";
}

function pickFeatureOption(fieldKey: string, raw: string): string {
  const field = INSPECTOR_FEATURE_FIELDS.find((f) => f.key === fieldKey);
  if (!field || !raw.trim()) return "";
  const match = field.options.find((opt) => opt === raw.trim() || raw.trim().includes(opt));
  return match ?? "";
}

/** The bourse answer for each inspector feature it can pre-answer (only the non-empty ones). */
export function bourseFeaturePrefill(
  property: BourseSource | null | undefined,
): Record<string, string> {
  if (!property) return {};
  const classification = property.classification.trim();
  const usage = (PROPERTY_CLASSIFICATIONS as readonly string[]).includes(classification)
    ? classification
    : (classificationForPropertyType(property.propertyType) ?? "");
  const values: Record<string, string> = {
    assetSubject: mapPropertyTypeToAssetSubject(property.propertyType),
    propertyUsage: usage,
    zoneStatus: pickFeatureOption("zoneStatus", property.deedStatus),
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v));
}

/** Copies the bourse answers into the draft's EMPTY features. Same reference when nothing changes. */
export function fillEmptyFeaturesFromBourse(
  draft: InspectorWorkspaceDraft,
  property: BourseSource | null | undefined,
): InspectorWorkspaceDraft {
  const prefill = bourseFeaturePrefill(property);
  const featureValues = { ...draft.featureValues };
  let changed = false;
  for (const [key, value] of Object.entries(prefill)) {
    if (featureValues[key]?.trim()) continue;
    featureValues[key] = value;
    changed = true;
  }
  return changed ? { ...draft, featureValues } : draft;
}

/** Source note per feature key — only for a field still holding exactly what the bourse answered. */
export function bourseSourceNotes(
  featureValues: Record<string, string | undefined>,
  property: BourseSource | null | undefined,
): Record<string, string> {
  const notes: Record<string, string> = {};
  const note = bourseSourceNote(property);
  for (const [key, value] of Object.entries(bourseFeaturePrefill(property))) {
    if ((featureValues[key] ?? "").trim() === value) notes[key] = note;
  }
  return notes;
}
