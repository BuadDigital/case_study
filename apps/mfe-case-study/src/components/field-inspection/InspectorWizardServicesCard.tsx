"use client";

/**
 * Wizard step 2 card of `InspectorWorkspaceWizard` - surrounding services and
 * amenities chips plus the defined-photo slots they unlock.
 */

import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  INSPECTOR_SERVICE_OPTIONS,
  isSpecialistProofService,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InsCard, ChipRow } from "../po-intake/PropertyDetailInspectionParts";
import { INS_LABEL_CLASS } from "./FieldInspectionWorkParts";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { withoutSpecialistProofSlots } from "./SpecialistServiceProofPhotoFields";
import { DESIGN_AMENITIES } from "./inspector-wizard-state";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";

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
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  return (
    <>
      <InsCard
        title="الخدمات والمرافق المحيطة"
        badge={<DetailBadge tone="gray">اختيار متعدد</DetailBadge>}
      >
        <span className={INS_LABEL_CLASS}>
          الخدمات المتوفرة
        </span>
        <ChipRow
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
          <ChipRow
            items={[...DESIGN_AMENITIES]}
            selected={draft.amenities.filter((a) =>
              (DESIGN_AMENITIES as readonly string[]).includes(a),
            )}
            onToggle={
              editable
                ? (item) => {
                    const extras = draft.amenities.filter(
                      (a) =>
                        !(DESIGN_AMENITIES as readonly string[]).includes(a),
                    );
                    const current = draft.amenities.filter((a) =>
                      (DESIGN_AMENITIES as readonly string[]).includes(a),
                    );
                    const next = current.includes(item)
                      ? current.filter((a) => a !== item)
                      : [...current, item];
                    onPatch({ amenities: [...next, ...extras] });
                  }
                : undefined
            }
          />
        </div>
        {draft.services.length > 0 || draft.amenities.length > 0 ? (
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
            />
          </div>
        ) : null}
      </InsCard>
    </>
  );
}
