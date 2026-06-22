import type { PoPropertyIntake } from "./po-intake-data";
import {
  INSPECTOR_FEATURE_FIELDS,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";

function mapPropertyTypeToAssetSubject(propertyType: string): string {
  const t = propertyType.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower.includes("فيلا") || lower.includes("villa")) return "فيلا";
  if (lower.includes("أرض") || lower.includes("ارض") || lower.includes("land"))
    return "أرض";
  if (lower.includes("شقة") || lower.includes("apartment")) return "شقة";
  if (lower.includes("عمارة") || lower.includes("building")) return "عمارة";
  if (lower.includes("محل") || lower.includes("تجار")) return "محل تجاري";
  if (lower.includes("مستودع") || lower.includes("warehouse")) return "مستودع";
  return "";
}

function mapClassificationToUsage(classification: string): string {
  const c = classification.trim();
  if (!c) return "";
  if (c.includes("سكن")) return "سكني";
  if (c.includes("تجار")) return "تجاري";
  if (c.includes("زراع")) return "زراعي";
  if (c.includes("صناع")) return "صناعي";
  return "";
}

function pickFeatureOption(
  fieldKey: string,
  raw: string,
): string {
  const field = INSPECTOR_FEATURE_FIELDS.find((f) => f.key === fieldKey);
  if (!field || !raw.trim()) return "";
  const match = field.options.find(
    (opt) => opt === raw.trim() || raw.trim().includes(opt),
  );
  return match ?? "";
}

/** Prefill inspector featureValues and scalar fields from Enfath / PO property data. */
export function applyEnfathPrefillToInspectorDraft(
  draft: InspectorWorkspaceDraft,
  property: PoPropertyIntake | null | undefined,
): InspectorWorkspaceDraft {
  if (!property) return draft;

  const featureValues = { ...draft.featureValues };
  let changed = false;

  const setFeature = (key: string, value: string) => {
    if (!value || featureValues[key]?.trim()) return;
    featureValues[key] = value;
    changed = true;
  };

  setFeature("assetSubject", mapPropertyTypeToAssetSubject(property.propertyType));
  setFeature("propertyUsage", mapClassificationToUsage(property.classification));
  setFeature(
    "zoneStatus",
    pickFeatureOption("zoneStatus", property.deedStatus),
  );

  const patch: Partial<InspectorWorkspaceDraft> = changed ? { featureValues } : {};

  if (!draft.buildLicenseNumber.trim() && property.buildLicenseNumber.trim()) {
    patch.buildLicenseNumber = property.buildLicenseNumber.trim();
    changed = true;
  }

  if (!draft.propertyDescription.trim()) {
    const parts = [
      property.city.trim(),
      property.district.trim(),
      property.area.trim() ? `${property.area.trim()} م²` : "",
    ].filter(Boolean);
    if (parts.length) {
      patch.propertyDescription = parts.join(" — ");
      changed = true;
    }
  }

  if (!changed) return draft;
  return { ...draft, ...patch };
}

export function inspectorDraftNeedsEnfathPrefill(
  draft: InspectorWorkspaceDraft,
): boolean {
  const hasFeatures = Object.values(draft.featureValues).some((v) => v.trim());
  return (
    !hasFeatures &&
    !draft.buildLicenseNumber.trim() &&
    !draft.propertyDescription.trim()
  );
}
