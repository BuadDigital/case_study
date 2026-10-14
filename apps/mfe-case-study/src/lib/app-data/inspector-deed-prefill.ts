import type { PoPropertyIntake } from "./po-intake-data";
import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import { fillEmptyFeaturesFromBourse } from "./inspector-bourse-prefill";

/** Prefill inspector featureValues and scalar fields from Enfath / PO property data. */
export function applyEnfathPrefillToInspectorDraft(
  draft: InspectorWorkspaceDraft,
  property: PoPropertyIntake | null | undefined,
): InspectorWorkspaceDraft {
  if (!property) return draft;

  const withFeatures = fillEmptyFeaturesFromBourse(draft, property);
  let changed = withFeatures !== draft;
  const patch: Partial<InspectorWorkspaceDraft> = changed
    ? { featureValues: withFeatures.featureValues }
    : {};

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
    !draft.propertyDescription.trim()
  );
}
