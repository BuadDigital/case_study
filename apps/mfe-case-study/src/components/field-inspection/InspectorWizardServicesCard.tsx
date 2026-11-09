"use client";

/**
 * Wizard step 2 card of `InspectorWorkspaceWizard` - surrounding services and
 * amenities chips plus the defined-photo slots they unlock, and the «عدادات الخدمات» card when
 * electricity or water is among the services (shared fields: `InspectorServiceMeterFields`).
 */

import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_SERVICE_OPTIONS,
  inspectorAmenityLabel,
  isSpecialistProofService,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InsCard, ChipRow } from "../po-intake/PropertyDetailInspectionParts";
import { INS_LABEL_CLASS } from "./FieldInspectionWorkParts";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { withoutSpecialistProofSlots } from "./SpecialistServiceProofPhotoFields";
import { InspectorServiceMeterFields } from "./InspectorServicesCards";

/** True for one of the listed amenity chips; other stored amenities are kept as they are. */
function isListedAmenity(value: string): boolean {
  return (INSPECTOR_AMENITY_OPTIONS as readonly string[]).includes(value);
}
import { inspectorServiceMeters } from "./field-inspection-work-state";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";

export function InspectorWizardServicesCard({
  draft,
  editable,
  fieldErrors,
  serviceProofFromTransactionPhotos,
  transactionPhotos,
  onPatch,
}: {
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  fieldErrors: InspectorWorkspaceFieldErrors;
  serviceProofFromTransactionPhotos: boolean;
  transactionPhotos: PropertyDetailDocumentEntry[];
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
}) {
  return (
    <>
      <InsCard
        title="الخدمات والمرافق المحيطة"
        badge={editable ? <DetailBadge tone="gray">اختيار متعدد</DetailBadge> : undefined}
      >
        <span className={INS_LABEL_CLASS}>
          الخدمات المتوفرة
        </span>
        <ChipRow
          selectedOnly={!editable}
          items={[...INSPECTOR_SERVICE_OPTIONS]}
          selected={draft.services}
          onToggle={
            editable
              ? (item) => {
                  const removing = draft.services.includes(item);
                  const nextServices = removing
                    ? draft.services.filter((s) => s !== item)
                    : [...draft.services, item];
                  const patch: Partial<InspectorWorkspaceDraft> = {
                    services: nextServices,
                  };
                  if (
                    serviceProofFromTransactionPhotos &&
                    removing &&
                    isSpecialistProofService(item)
                  ) {
                    patch.definedPhotos = withoutSpecialistProofSlots(
                      draft,
                      [item],
                    );
                  }
                  onPatch(patch);
                }
              : undefined
          }
        />
        <div className="mt-3">
          <span className={INS_LABEL_CLASS}>
            المرافق المحيطة
          </span>
          {/* The phone's eight amenities (2026-11-04: the desktop had six — no «مرفق أمني» / «مقر حكومي»). */}
          <ChipRow
            selectedOnly={!editable}
            items={[...INSPECTOR_AMENITY_OPTIONS]}
            labelOf={inspectorAmenityLabel}
            selected={draft.amenities.filter(isListedAmenity)}
            onToggle={
              editable
                ? (item) => {
                    const extras = draft.amenities.filter((a) => !isListedAmenity(a));
                    const current = draft.amenities.filter(isListedAmenity);
                    const next = current.includes(item)
                      ? current.filter((a) => a !== item)
                      : [...current, item];
                    onPatch({ amenities: [...next, ...extras] });
                  }
                : undefined
            }
          />
        </div>
        <div id="ins-defined-photos" className="mt-4 border-t border-border pt-3">
            {fieldErrors.definedPhotos ? (
              <p className="mb-2 text-[10px] text-danger-text" role="alert">
                {fieldErrors.definedPhotos}
              </p>
            ) : null}
            <InspectorDefinedPhotosSection
              draft={draft}
              disabled={!editable}
              onPatch={onPatch}
              layout="desktop"
              transactionPhotos={
                serviceProofFromTransactionPhotos
                  ? transactionPhotos
                  : undefined
              }
              invalidSlotId={fieldErrors.missingDefinedPhotoSlotId}
            />
          </div>
      </InsCard>
      {/* A→Z 2026-11-02 #31: the meters card existed on the phone only — the same fields here. */}
      {inspectorServiceMeters(draft.services).any ? (
        <InsCard title="عدادات الخدمات">
          <InspectorServiceMeterFields draft={draft} disabled={!editable} onPatch={onPatch} />
        </InsCard>
      ) : null}
    </>
  );
}
