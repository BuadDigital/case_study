"use client";

/**
 * Field Inspection Workspace — source of truth:
 * `Field Inspection Workspace.dc.html`
 * Only the three wizard steps from that design. Each step's cards live in
 * sibling components; pure rules live in `inspector-wizard-state.ts`.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, cn, useToast } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  boundariesMarkedUnavailable,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  isLandInspectionContext,
  isCommercialShopInspectionContext,
  visibleInspectorFeatureFields,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InspectorStepNav, type InspectorStepId } from "./InspectorStepNav";
import { InspectorFeatureWizardFields } from "./InspectorFeatureWizardFields";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { InsCard, InsEditTextarea } from "../po-intake/PropertyDetailInspectionParts";
import { InspectorCaseStudyChips } from "./InspectorCaseStudyChips";
import { InspectorWizardLocationStep } from "./InspectorWizardLocationStep";
import { InspectorWizardComponentsCards } from "./InspectorWizardComponentsCards";
import { InspectorBoundaryMatchTable } from "./InspectorBoundaryMatchTable";
import { InspectorWizardServicesCard } from "./InspectorWizardServicesCard";
import { InspectorFieldObservationsCard } from "./InspectorFieldObservationsCard";
import { COMPONENT_BOOL_KEYS } from "./inspector-wizard-state";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorWizardStepForErrorTarget,
  inspectorWorkspaceHasBlockingErrors,
  pickInspectorErrorsForWizardStep,
  scheduleInspectorErrorScroll,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";

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
  mapPinEpoch,
  mapActor = "inspector",
  canRestoreInspectorMap = false,
  onRestoreInspectorMap,
  /** Property-detail review: show all design sections at once (no step filter). */
  flat = false,
  /** Hide inline submit footer — parent renders it after extra sections. */
  hideSubmitFooter = false,
  onStepGateFailed,
  onStepGateClear,
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
  mapPinEpoch: number;
  mapActor?: InspectorMapActor;
  canRestoreInspectorMap?: boolean;
  onRestoreInspectorMap?: () => void;
  flat?: boolean;
  hideSubmitFooter?: boolean;
  onStepGateFailed?: (
    errors: InspectorWorkspaceFieldErrors,
    message: string,
  ) => void;
  onStepGateClear?: () => void;
}) {
  const { showToast } = useToast();
  const [activeStep, setActiveStep] = useState<InspectorStepId>(1);
  const [doneSteps, setDoneSteps] = useState<Set<InspectorStepId>>(
    () => new Set(flat ? ([1, 2, 3] as InspectorStepId[]) : []),
  );
  const editable = !locked;
  const showStep = (step: InspectorStepId) => flat || activeStep === step;
  const isLand = isLandInspectionContext({
    vacantLand: draft.vacantLand,
    assetSubject: draft.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const isShop = isCommercialShopInspectionContext({
    vacantLand: draft.vacantLand,
    assetSubject: draft.featureValues.assetSubject,
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

  const validationOptions = {
    boundariesUnavailable: boundariesMarkedUnavailable(
      property.boundariesAvailability,
    ),
    classification: property.classification,
    propertyType: property.propertyType,
    includeRetiredFeatureKeys,
    specialistProofServicesOnly: serviceProofFromTransactionPhotos,
  };

  function revealStepErrors(
    step: InspectorStepId,
    stepErrors: InspectorWorkspaceFieldErrors,
  ) {
    const message =
      firstInspectorWorkspaceError(stepErrors) ??
      "أكمل الحقول الناقصة قبل المتابعة";
    onStepGateFailed?.(stepErrors, message);
    showToast(message, "error");
    setActiveStep(step);
  }

  function stepHasGaps(step: InspectorStepId): InspectorWorkspaceFieldErrors | null {
    const stepErrors = pickInspectorErrorsForWizardStep(
      validateInspectorWorkspace(draft, validationOptions),
      step,
    );
    return inspectorWorkspaceHasBlockingErrors(stepErrors) ? stepErrors : null;
  }

  function gateStep(step: InspectorStepId): boolean {
    const stepErrors = stepHasGaps(step);
    if (!stepErrors) return true;
    revealStepErrors(step, stepErrors);
    return false;
  }

  function advance() {
    if (!gateStep(activeStep)) return;
    onStepGateClear?.();
    setDoneSteps((prev) => {
      const next = new Set(prev);
      next.add(activeStep);
      return next;
    });
    setActiveStep((prev) => (prev === 3 ? prev : ((prev + 1) as InspectorStepId)));
  }

  function selectStep(next: InspectorStepId) {
    if (next <= activeStep) {
      setActiveStep(next);
      return;
    }
    for (let step = activeStep; step < next; step += 1) {
      const current = step as InspectorStepId;
      if (!gateStep(current)) return;
      setDoneSteps((prev) => {
        const copy = new Set(prev);
        copy.add(current);
        return copy;
      });
    }
    onStepGateClear?.();
    setActiveStep(next);
  }

  useEffect(() => {
    const targetId = firstInspectorWorkspaceErrorTarget(fieldErrors);
    if (!targetId) return;
    if (!flat) {
      setActiveStep(inspectorWizardStepForErrorTarget(targetId));
    }
    scheduleInspectorErrorScroll(fieldErrors, flat ? 60 : 100);
  }, [fieldErrors, flat]);

  return (
    <div>
      {!flat ? (
        <InspectorStepNav
          activeStep={activeStep}
          doneSteps={doneSteps}
          onSelect={selectStep}
        />
      ) : null}

      {showStep(1) ? (
        <>
          <InspectorWizardLocationStep
            property={property}
            draft={draft}
            editable={editable}
            fieldErrors={fieldErrors}
            serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
            onPatch={onPatch}
            onMapMove={onMapMove}
            mapPinned={mapPinned}
            onPin={onPin}
            mapPinEpoch={mapPinEpoch}
            mapActor={mapActor}
            canRestoreInspectorMap={canRestoreInspectorMap}
            onRestoreInspectorMap={onRestoreInspectorMap}
          />

          {editable && !flat ? (
            <StepContinue onContinue={advance} />
          ) : null}
        </>
      ) : null}

      {showStep(2) ? (
        <>
          <InsCard title="وصف العقار">
            <InsEditTextarea
              label="وصف العقار"
              value={draft.propertyDescription}
              onChange={(v) => onPatch({ propertyDescription: v })}
              disabled={!editable}
            />
          </InsCard>

          <InsCard title="خصائص العقار">
            <div id="ins-features-section">
            <InspectorFeatureWizardFields
              fields={featureFields}
              draft={draft}
              deedNumber={property.deedNumber}
              emptyFeatureKeys={fieldErrors.emptyFeatureKeys}
              missingFeaturePhotoKey={fieldErrors.missingFeaturePhotoKey}
              movablesDescriptionError={fieldErrors.movablesDescription}
              occupancyDescriptionError={fieldErrors.occupancyDescription}
              disabled={!editable}
              onPatch={onPatch}
            />
            </div>
          </InsCard>

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
                forceReadOnly={!editable}
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
  );
}

export function InspectorWorkspaceSubmitFooter({
  draft,
  saving,
  confirmInvalid = false,
  submitLabel = "حفظ وإرسال",
  onPatch,
  onSubmit,
  onCancel,
}: {
  draft: InspectorWorkspaceDraft;
  saving: boolean;
  confirmInvalid?: boolean;
  submitLabel?: string;
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
        أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني
      </label>
      <span className="flex-1" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        loading={saving}
        disabled={saving || !draft.inspectionConfirmed}
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
        كل بطاقة تُحفظ تلقائياً عند الإدخال — «حفظ ومتابعة» يعتمد المرحلة وينتقل
        للتالية.
      </span>
      <span className="flex-1" />
      <Button type="button" variant="primary" size="sm" onClick={onContinue}>
        حفظ ومتابعة
      </Button>
    </div>
  );
}
