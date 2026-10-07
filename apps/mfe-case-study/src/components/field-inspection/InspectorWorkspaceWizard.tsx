"use client";

/**
 * Field Inspection Workspace — source of truth:
 * `Field Inspection Workspace.dc.html`
 * Only the three wizard steps from that design. Each step's cards live in
 * sibling components; pure rules live in `inspector-wizard-state.ts`.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, cn, useSwapAnimation } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { ValuedDocumentUploadButton } from "@platform/app-shared/components/ValuedDocumentUploadButton";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canReviewValuedDocuments } from "../../lib/app-data/po-roles";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import { type PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  isLandInspectionContext,
  isCommercialShopInspectionContext,
  resolvedInspectorAssetSubject,
  submittedInspectorAssetIsLand,
  visibleInspectorFeatureFields,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InspectorStepNav, type InspectorStepId } from "./InspectorStepNav";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { InsCard, InsEditTextarea } from "../po-intake/PropertyDetailInspectionParts";
import { InspectorDescriptionPhoto } from "./InspectorDescriptionPhoto";
import { InspectorCaseStudyChips } from "./InspectorCaseStudyChips";
import { InspectorLandStructuresQuestion } from "./InspectorLandStructuresQuestion";
import { inspectorInventoryVisible } from "../../lib/app-data/building-inventory-editor-state";
import { inspectedAssetIsLand } from "../../lib/app-data/specialist-components";
import { InspectorWizardLocationStep } from "./InspectorWizardLocationStep";
import { InspectorInventoryEditor } from "./InspectorInventoryEditor";
import { InspectorWizardComponentsCards } from "./InspectorWizardComponentsCards";
import { InspectorBoundaryMatchTable } from "./InspectorBoundaryMatchTable";
import { InspectorWizardServicesCard } from "./InspectorWizardServicesCard";
import { InspectorFieldObservationsCard } from "./InspectorFieldObservationsCard";
import { COMPONENT_BOOL_KEYS } from "./inspector-wizard-state";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import {
  firstInspectorWorkspaceErrorTarget,
  inspectorWizardStepForErrorTarget,
  scheduleInspectorErrorScroll,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "../../lib/app-data/tasks";

export function InspectorWorkspaceWizard({
  property,
  draft,
  inspectionTask,
  caseStudyDef,
  includeRetiredFeatureKeys,
  serviceProofFromTransactionPhotos = false,
  transactionPhotos = [],
  locked,
  saving,
  fieldErrors = {},
  onPatch,
  onSubmit,
  onCancel,
  onMapMove,
  mapPinned,
  onPin,
  onUnpin,
  mapPinEpoch,
  mapActor = "inspector",
  canRestoreInspectorMap = false,
  onRestoreInspectorMap,
  canAdoptEngineeringMap = false,
  onAdoptEngineeringMap,
  engineeringMapPin = null,
  /** Property-detail review: show all design sections at once (no step filter). */
  flat = false,
  /** Hide inline submit footer — parent renders it after extra sections. */
  hideSubmitFooter = false,
  /** Case specialist: «مكونات العقار» (report text + table) replaces the editable description. */
  specialistComponents,
}: {
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  inspectionTask: WorkflowTask;
  caseStudyDef?: PartyTaskPageDef;
  includeRetiredFeatureKeys?: readonly string[];
  /** Case-study specialist: proof photos for كهرباء/ماء from transaction images. */
  serviceProofFromTransactionPhotos?: boolean;
  transactionPhotos?: PropertyDetailDocumentEntry[];
  locked: boolean;
  saving: boolean;
  fieldErrors?: InspectorWorkspaceFieldErrors;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onMapMove: (lat: number, lng: number) => void;
  mapPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  mapPinEpoch: number;
  mapActor?: InspectorMapActor;
  canRestoreInspectorMap?: boolean;
  onRestoreInspectorMap?: () => void;
  canAdoptEngineeringMap?: boolean;
  onAdoptEngineeringMap?: () => void;
  engineeringMapPin?: { lat: number; lng: number } | null;
  flat?: boolean;
  hideSubmitFooter?: boolean;
  specialistComponents?: ReactNode;
}) {
  const { role } = useAppAccess();
  const [activeStep, setActiveStep] = useState<InspectorStepId>(1);
  const editable = !locked;
  const showStep = (step: InspectorStepId) => flat || activeStep === step;
  const stepPanelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(stepPanelRef, flat ? 0 : activeStep);
  const initialAssetSubject =
    property.propertyType?.trim() || property.classification?.trim() || "";
  const roleOwnedAssetSubject = resolvedInspectorAssetSubject({
    status: draft.status,
    assetSubject: draft.featureValues.assetSubject,
    initialAssetSubject,
  });
  const isLand = serviceProofFromTransactionPhotos
    ? submittedInspectorAssetIsLand({
        status: draft.status,
        assetSubject: draft.featureValues.assetSubject,
        initialAssetSubject,
      })
    : isLandInspectionContext({
        vacantLand: draft.vacantLand,
        assetSubject: draft.featureValues.assetSubject,
        classification: property.classification,
        propertyType: property.propertyType,
      });
  const isShop = isCommercialShopInspectionContext({
    vacantLand: draft.vacantLand,
    assetSubject: serviceProofFromTransactionPhotos
      ? roleOwnedAssetSubject
      : draft.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const featureFields = useMemo(
    () =>
      visibleInspectorFeatureFields(isLand, {
        includeRetiredKeys: includeRetiredFeatureKeys,
      }).filter(
        (f) =>
          !COMPONENT_BOOL_KEYS.includes(
            f.key as (typeof COMPONENT_BOOL_KEYS)[number],
          ),
      ),
    [isLand, includeRetiredFeatureKeys],
  );

  function advance() {
    setActiveStep((prev) => (prev === 3 ? prev : ((prev + 1) as InspectorStepId)));
  }

  // Validation errors move the wizard to the step that holds the first one, then
  // the scroll runs as an effect because it touches the DOM.
  const [prevFieldErrors, setPrevFieldErrors] = useState(fieldErrors);
  if (prevFieldErrors !== fieldErrors) {
    setPrevFieldErrors(fieldErrors);
    const targetId = firstInspectorWorkspaceErrorTarget(fieldErrors);
    if (targetId && !flat) {
      setActiveStep(inspectorWizardStepForErrorTarget(targetId));
    }
  }

  useEffect(() => {
    if (!firstInspectorWorkspaceErrorTarget(fieldErrors)) return;
    scheduleInspectorErrorScroll(fieldErrors, flat ? 60 : 180);
  }, [fieldErrors, flat]);

  return (
    <div>
      {!flat ? (
        <InspectorStepNav
          activeStep={activeStep}
          onSelect={setActiveStep}
        />
      ) : null}

      <div ref={stepPanelRef}>
        {showStep(1) ? (
          <>
            <InspectorWizardLocationStep
              property={property}
              draft={draft}
              editable={editable}
              fieldErrors={fieldErrors}
              featureFields={featureFields}
              serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
              onPatch={onPatch}
              onMapMove={onMapMove}
              mapPinned={mapPinned}
              onPin={onPin}
              onUnpin={onUnpin}
              mapPinEpoch={mapPinEpoch}
              mapActor={mapActor}
              canRestoreInspectorMap={canRestoreInspectorMap}
              onRestoreInspectorMap={onRestoreInspectorMap}
              canAdoptEngineeringMap={canAdoptEngineeringMap}
              onAdoptEngineeringMap={onAdoptEngineeringMap}
              engineeringMapPin={engineeringMapPin}
            />

            {editable && !flat ? (
              <StepContinue onContinue={advance} />
            ) : null}
          </>
        ) : null}

        {showStep(2) ? (
          <>
            {specialistComponents ? (
              <InsCard title="وصف العقار ومكوناته">{specialistComponents}</InsCard>
            ) : (
            <InsCard title="وصف العقار">
              <InsEditTextarea
                id="ins-desc"
                label="وصف العقار"
                hint="نص يصف العقار، أو صورة لتفاصيل المكونات — أحدهما على الأقل"
                value={draft.propertyDescription}
                onChange={(v) => onPatch({ propertyDescription: v })}
                disabled={!editable}
                invalid={Boolean(fieldErrors.propertyDescription)}
                errorMessage={fieldErrors.propertyDescription}
              />
              <InspectorDescriptionPhoto
                deedNumber={property.deedNumber}
                draft={draft}
                editable={editable}
                invalid={Boolean(fieldErrors.propertyDescription)}
                onPatch={onPatch}
              />
            </InsCard>
            )}

            {inspectedAssetIsLand(draft.featureValues.assetSubject) ? (
              <InsCard title="مبانٍ أو ملاحق على الأرض">
                <InspectorLandStructuresQuestion
                  value={draft.landHasValuableStructures}
                  mobile={false}
                  disabled={!editable}
                  errorMessage={fieldErrors.landHasValuableStructures}
                  onChange={(next) => onPatch({ landHasValuableStructures: next })}
                />
              </InsCard>
            ) : null}

            <InspectorWizardComponentsCards
              deedNumber={property.deedNumber}
              draft={draft}
              editable={editable}
              locked={locked}
              isLand={isLand}
              isShop={isShop}
              missingFeaturePhotoKey={fieldErrors.missingFeaturePhotoKey}
              missingComponentPhotoKey={fieldErrors.missingComponentPhotoKey}
              onPatch={onPatch}
            />

            {/* Same «جدول الحصر» the phone shell shows — the inspector fills it on either device.
                Hidden for the case specialist, whose own section already carries the table. */}
            {!specialistComponents &&
            property.id &&
            inspectorInventoryVisible({
              assetSubject: draft.featureValues.assetSubject,
              landHasValuableStructures: draft.landHasValuableStructures,
            }) ? (
              <InsCard title="جدول الحصر">
                <InspectorInventoryEditor
                  draft={draft}
                  mobile={false}
                  poNumber={inspectionTask.poNumber}
                  propertyId={property.id}
                  taskId={inspectionTask.id}
                  workLocked={!editable}
                />
              </InsCard>
            ) : null}

            <InspectorBoundaryMatchTable
              property={property}
              draft={draft}
              editable={editable}
              mismatchNoteInvalidKey={fieldErrors.missingBoundaryKey}
              onPatch={onPatch}
            />

            <InspectorWizardServicesCard
              draft={draft}
              editable={editable}
              fieldErrors={fieldErrors}
              serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
              transactionPhotos={transactionPhotos}
              onPatch={onPatch}
            />

            {editable && !flat ? <StepContinue onContinue={advance} /> : null}
          </>
        ) : null}

        {showStep(3) ? (
          <>
            <InsCard title="العقارات المقارنة">
              <FieldComparableCaptureSection
                latitude={draft.mapLatitude}
                longitude={draft.mapLongitude}
                city={property.city}
                district={property.district}
                propertyType={property.propertyType}
                poNumber={inspectionTask.poNumber}
                propertyId={property.id}
                disabled={!editable}
              />
            </InsCard>

            {editable ? (
              <InsCard title="مستندات ذات قيمة">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="m-0 min-w-0 flex-1 basis-64 text-[11.5px] leading-relaxed text-text-3">
                    مستند يحمل قيمة وجدته في الموقع (مثل تقييم للآلات أو المنقولات) — يراجعه أخصائي
                    دراسة الحالة ويقرر المقيّم أثره.
                  </p>
                  <ValuedDocumentUploadButton
                    poNumber={inspectionTask.poNumber}
                    propertyId={property.id}
                    canReview={canReviewValuedDocuments(role)}
                  />
                </div>
              </InsCard>
            ) : null}

            {serviceProofFromTransactionPhotos ? (
              <InsCard
                title="الوصف والملاحظات"
                badge={<DetailBadge tone="gray">نص حر</DetailBadge>}
              >
                <InsEditTextarea
                  label="الإيجابيات والعيوب الظاهرة على الحي"
                  value={draft.districtProsCons}
                  onChange={(v) => onPatch({ districtProsCons: v })}
                  disabled={!editable}
                />
                <div className="mt-3">
                  <InsEditTextarea
                    label="ملاحظات على الأصل"
                    value={draft.assetNotes}
                    onChange={(v) => onPatch({ assetNotes: v })}
                    disabled={!editable}
                  />
                </div>
              </InsCard>
            ) : null}

            <InspectorFieldObservationsCard
              deedNumber={property.deedNumber}
              draft={draft}
              editable={editable}
              serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
              transactionPhotos={transactionPhotos}
              missingObservationId={fieldErrors.missingObservationId}
              onPatch={onPatch}
            />

            {caseStudyDef ? (
              <InsCard title="أسئلة دراسة الحالة — المعاين">
                <InspectorCaseStudyChips
                  def={caseStudyDef}
                  childTask={inspectionTask}
                  // Specialist review edits inspection facts, not the inspector's party answers.
                  forceReadOnly={!editable || serviceProofFromTransactionPhotos}
                />
              </InsCard>
            ) : null}

            {editable && !hideSubmitFooter ? (
              <InspectorWorkspaceSubmitFooter
                draft={draft}
                saving={saving}
                confirmInvalid={Boolean(fieldErrors.inspectionConfirmed)}
                onPatch={onPatch}
                onSubmit={onSubmit}
                onCancel={onCancel}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function InspectorWorkspaceSubmitFooter({
  draft,
  saving,
  confirmInvalid = false,
  submitDisabled = false,
  submitLabel = "حفظ وإرسال",
  confirmLabel = "أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني",
  onPatch,
  onSubmit,
  onCancel,
}: {
  draft: InspectorWorkspaceDraft;
  saving: boolean;
  confirmInvalid?: boolean;
  /** Extra gate (e.g. specialist finishing level not chosen yet). */
  submitDisabled?: boolean;
  submitLabel?: string;
  /** Defaults to the field inspector pledge; specialist passes a review ack. */
  confirmLabel?: string;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
      <label
        id="ins-confirm"
        className={cn(
          "flex cursor-pointer items-center gap-2 text-xs text-text-2",
          confirmInvalid && invalidControlClass,
        )}
      >
        <input
          type="checkbox"
          className="size-[15px] accent-ink"
          checked={draft.inspectionConfirmed}
          onChange={(e) => onPatch({ inspectionConfirmed: e.target.checked })}
        />
        {confirmLabel}
      </label>
      <span className="flex-1" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        loading={saving}
        disabled={saving || !draft.inspectionConfirmed || submitDisabled}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={onCancel}
      >
        رجوع
      </Button>
    </div>
  );
}

function StepContinue({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-[11.5px] text-text-3">
        كل بطاقة تُحفظ تلقائياً عند الإدخال — يمكنك تصفح المراحل بحرية، والتحقق
        يتم عند الإرسال.
      </span>
      <span className="flex-1" />
      <Button type="button" variant="primary" size="sm" onClick={onContinue}>
        حفظ ومتابعة
      </Button>
    </div>
  );
}
