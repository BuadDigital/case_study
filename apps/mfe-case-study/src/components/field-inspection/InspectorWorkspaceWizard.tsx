"use client";

/**
 * Field Inspection Workspace — source of truth:
 * `Field Inspection Workspace.dc.html`
 * Only the three wizard steps from that design. Each step's cards live in
 * sibling components; pure rules live in `inspector-wizard-state.ts`.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, cn, useToast, useWorkSections, WorkSectionsLayout } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import { type PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  isLandInspectionContext,
  isApartmentInspectionContext,
  isCommercialShopInspectionContext,
  resolvedInspectorAssetSubject,
  submittedInspectorAssetIsLand,
  visibleInspectorFeatureFields,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import type { InspectorStepId } from "./InspectorStepNav";
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
import { InspectionLimitsSection } from "./InspectionLimitsSection";
import { InspectorValuedDocumentsField } from "./InspectorValuedDocumentsField";
import {
  InspectorClientDeclarationField,
  InspectorKeyStatusNotes,
} from "./InspectorSubmitPrerequisites";
import type { InspectorKeyAvailability } from "./InspectorKeyStatusTab";
import type { InspectorMapMoveOutcome } from "./InspectorMapActionButtons";
import {
  COMPONENT_BOOL_KEYS,
  INSPECTOR_FRAME_SECTIONS,
  firstInspectorStepToComplete,
  inspectorFrameStep,
  inspectorSectionId,
  type InspectorSectionId,
} from "./inspector-wizard-state";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorMustDecideDeedMatch,
  inspectorWizardStepForErrorTarget,
  inspectorWorkspaceHasBlockingErrors,
  pickInspectorErrorsForWizardStep,
  scheduleInspectorErrorScroll,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import { boundariesMarkedUnavailable } from "../../lib/app-data/po-intake-data";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";

/**
 * The desktop inspection form (the inspector's `/active-inspection` page in three steps, and the
 * property page's inspection tab `flat`, all steps at once — also the specialist's review).
 *
 * How it works: step 1 = `InspectorWizardLocationStep`; step 2 = description, land structures,
 * components, «حدود المعاينة», «جدول الحصر», boundaries and services; step 3 = comparables,
 * «مستندات ذات قيمة», observations, the key notes and the client declaration (inspector only), and
 * the inspector's case-study questions. Validation errors open the step holding the first one
 * (desktop step order of `inspectorWizardStepForErrorTarget`).
 *
 * The inspector's page (not `flat`) is drawn on the work page's frame (Omar 2026-11-12: the
 * inspector's screen like the specialists' and the appraiser's; the phone shell is untouched): the
 * three steps are the frame's numbered sections on a rail, folded at entry like every frame page,
 * and «حفظ وإرسال» is the frame's closing action under them. The section's status follows the step
 * the inspector has reached — at entry the first step with a required field missing, then
 * «حفظ ومتابعة» by «حفظ ومتابعة»; a refused send goes back to the step holding the first error.
 *
 * Edge cases: brought level with the phone 2026-11-04 — «حدود المعاينة», the key notes, the client
 * declaration, GPS / undo on the map, the full component counts and amenities were phone-only.
 */
export function InspectorWorkspaceWizard({
  property,
  draft,
  inspectionTask,
  caseStudyDef,
  includeRetiredFeatureKeys,
  serviceProofFromTransactionPhotos = false,
  transactionPhotos = [],
  transactionDocuments = [],
  transactionDocumentsLoading = false,
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
  boundariesShownAbove = false,
  /** Case specialist: «مكونات العقار» (report text + table) replaces the editable description. */
  specialistComponents,
  keyAvailability,
  onRegisterKeyFailure,
  canUndoMapMove = false,
  onUndoMapMove,
  railAside,
}: {
  /** The inspector's page: the host's cards under the sections rail (the parties' status). */
  railAside?: ReactNode;
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  inspectionTask: WorkflowTask;
  caseStudyDef?: PartyTaskPageDef;
  includeRetiredFeatureKeys?: readonly string[];
  /** Case-study specialist: proof photos for كهرباء/ماء from transaction images. */
  serviceProofFromTransactionPhotos?: boolean;
  transactionPhotos?: PropertyDetailDocumentEntry[];
  /** Read-only transaction documents shown in step 1. */
  transactionDocuments?: PropertyDetailDocumentEntry[];
  transactionDocumentsLoading?: boolean;
  locked: boolean;
  saving: boolean;
  fieldErrors?: InspectorWorkspaceFieldErrors;
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onMapMove: (lat: number, lng: number) => InspectorMapMoveOutcome | void;
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
  /**
   * The host already shows the four sides (the specialist's «مطابقة الصك على الطبيعة» card): the
   * read-only «الحدود والأطوال» table is not repeated. While the sides can be edited it shows.
   */
  boundariesShownAbove?: boolean;
  specialistComponents?: ReactNode;
  /** The inspector's key-envelope answer (key notes in step 3); absent for the specialist. */
  keyAvailability?: Pick<InspectorKeyAvailability, "keyAvailable" | "status" | "retry">;
  /** «تسجيل تعذّر المفتاح» under the «المفتاح غير مُسلَّم» note. */
  onRegisterKeyFailure?: () => void;
  /** A confirmed pin move can be undone («رجوع للموقع السابق»). */
  canUndoMapMove?: boolean;
  onUndoMapMove?: () => void;
}) {
  const editable = !locked;
  /**
   * Whether a step still has a required field missing (the inspector's own form only).
   * How it works: the submit validation on the draft, narrowed to the step's fields
   * (pickInspectorErrorsForWizardStep). The declaration (step 3) is never asked here.
   */
  const stepErrorsOf = (step: InspectorStepId) => {
    const all = validateInspectorWorkspace(draft, {
      boundariesUnavailable: boundariesMarkedUnavailable(property.boundariesAvailability),
      classification: property.classification,
      propertyType: property.propertyType,
      requireDeedMatch: inspectorMustDecideDeedMatch(property),
      requireLandStructures: true,
      requirePhotoMinimums: true,
    });
    const stepErrors = pickInspectorErrorsForWizardStep(all, step);
    delete stepErrors.inspectionConfirmed;
    return stepErrors;
  };
  // The step reached: read once from the draft at entry, then moved by «حفظ ومتابعة» and by a
  // refused send — never while typing, so a section does not open or scroll under the inspector.
  const [activeStep, setActiveStep] = useState<InspectorStepId>(() =>
    flat || locked || mapActor !== "inspector"
      ? 1
      : firstInspectorStepToComplete((step) =>
          inspectorWorkspaceHasBlockingErrors(stepErrorsOf(step)),
        ),
  );
  const frameStep = inspectorFrameStep(activeStep, locked);
  const frame = useWorkSections<InspectorSectionId>({
    sections: INSPECTOR_FRAME_SECTIONS,
    step: frameStep,
    ready: true,
    // The inspector's own page: the section he stands at carries the frame's tint.
    ownsPage: true,
  });
  const { focusSection, openSection } = frame;
  // Omar 2026-11-12: a read view (a locked review, a page that only shows the inspection) gives
  // no card to a section with nothing in it — the empty ones are named in one line at the end.
  // Only where every section is on one page (`flat`); the inspector's own steps keep their cards.
  const collapseEmpty = flat && !editable;
  const emptySections = collapseEmpty
    ? [
        draft.services.length === 0 && draft.amenities.length === 0
          ? "الخدمات والمرافق المحيطة"
          : null,
        serviceProofFromTransactionPhotos &&
        !draft.districtProsCons?.trim() &&
        !draft.assetNotes?.trim()
          ? "الوصف والملاحظات"
          : null,
        draft.observations.length === 0 ? "الملاحظات الميدانية" : null,
      ].filter((title): title is string => title !== null)
    : [];
  const isEmptySection = (title: string) => emptySections.includes(title);
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
  const isApartment = isApartmentInspectionContext({
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
        isApartment,
      }).filter(
        (f) =>
          !COMPONENT_BOOL_KEYS.includes(
            f.key as (typeof COMPONENT_BOOL_KEYS)[number],
          ),
      ),
    [isLand, isApartment, includeRetiredFeatureKeys],
  );

  const { showToast } = useToast();

  /**
   * «حفظ ومتابعة» at the end of section `from`: moves to the next section once this one's required
   * fields are filled.
   *
   * How it works: runs the submit validation on the draft, keeps only the errors that belong to
   * `from` (`stepErrorsOf`) and, when any is blocking, stays in the section, names the first
   * missing field and scrolls to it. Otherwise the next section opens alone and scrolls into view,
   * and becomes the step reached unless the inspector is already past it.
   *
   * Edge cases: the declaration (step 3) is never asked here. Fixed 2026-10-28 — the step moved on
   * regardless, so a missing «حالة منطقة العقار» surfaced only at the final «حفظ وإرسال».
   */
  function advance(from: 1 | 2) {
    if (mapActor === "inspector") {
      const stepErrors = stepErrorsOf(from);
      if (inspectorWorkspaceHasBlockingErrors(stepErrors)) {
        showToast(firstInspectorWorkspaceError(stepErrors) ?? "أكمل الحقول المطلوبة في هذه الخطوة", "error");
        scheduleInspectorErrorScroll(stepErrors, 60);
        return;
      }
    }
    const next: InspectorStepId = from === 1 ? 2 : 3;
    setActiveStep((prev) => (prev < next ? next : prev));
    focusSection(inspectorSectionId(next));
  }

  // Validation errors move the page to the step that holds the first one; opening its section
  // and the scroll run as an effect because they touch the DOM.
  const [prevFieldErrors, setPrevFieldErrors] = useState(fieldErrors);
  if (prevFieldErrors !== fieldErrors) {
    setPrevFieldErrors(fieldErrors);
    const targetId = firstInspectorWorkspaceErrorTarget(fieldErrors);
    if (targetId && !flat) {
      setActiveStep(inspectorWizardStepForErrorTarget(targetId));
    }
  }

  useEffect(() => {
    const targetId = firstInspectorWorkspaceErrorTarget(fieldErrors);
    if (!targetId) return;
    // The field may sit in a folded (or never opened) section: open it before scrolling to it.
    if (!flat) openSection(inspectorSectionId(inspectorWizardStepForErrorTarget(targetId)), false);
    scheduleInspectorErrorScroll(fieldErrors, flat ? 60 : 180);
  }, [fieldErrors, flat, openSection]);

  const submitFooter =
    editable && !hideSubmitFooter ? (
      <InspectorWorkspaceSubmitFooter
        draft={draft}
        saving={saving}
        confirmInvalid={Boolean(fieldErrors.inspectionConfirmed)}
        onPatch={onPatch}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    ) : null;

  const stepOne = (
    <>
      <InspectorWizardLocationStep
        property={property}
        draft={draft}
        editable={editable}
        fieldErrors={fieldErrors}
        featureFields={featureFields}
        serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
        isLand={isLand}
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
        transactionDocuments={transactionDocuments}
        transactionDocumentsLoading={transactionDocumentsLoading}
        canUndoMapMove={canUndoMapMove}
        onUndoMapMove={onUndoMapMove}
      />

      {editable && !flat ? (
        <StepContinue onContinue={() => advance(1)} />
      ) : null}
    </>
  );

  const stepTwo = (
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

      {/* «حدود المعاينة» — the phone's step-2 card (scope, uninspected units, restriction).
          The inspector's to fill (the save needs party-work rights); the review reads it. */}
      {property.id ? (
        <InsCard title="حدود المعاينة">
          <InspectionLimitsSection
            poNumber={inspectionTask.poNumber}
            propertyId={property.id}
            disabled={!editable || serviceProofFromTransactionPhotos}
          />
        </InsCard>
      ) : null}

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

      {boundariesShownAbove && !editable ? null : (
        <InspectorBoundaryMatchTable
          property={property}
          draft={draft}
          editable={editable}
          mismatchNoteInvalidKey={fieldErrors.missingBoundaryKey}
          deedMatchError={fieldErrors.deedMatchesNature}
          boundariesError={fieldErrors.boundaries}
          onPatch={onPatch}
        />
      )}

      {isEmptySection("الخدمات والمرافق المحيطة") ? null : (
        <InspectorWizardServicesCard
          draft={draft}
          editable={editable}
          fieldErrors={fieldErrors}
          serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
          transactionPhotos={transactionPhotos}
          onPatch={onPatch}
        />
      )}

      {editable && !flat ? <StepContinue onContinue={() => advance(2)} /> : null}
    </>
  );

  const stepThree = (
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
          <InspectorValuedDocumentsField
            poNumber={inspectionTask.poNumber}
            propertyId={property.id}
          />
        </InsCard>
      ) : null}

      {serviceProofFromTransactionPhotos && !isEmptySection("الوصف والملاحظات") ? (
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

      {isEmptySection("الملاحظات الميدانية") ? null : (
        <InspectorFieldObservationsCard
          deedNumber={property.deedNumber}
          draft={draft}
          editable={editable}
          serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
          transactionPhotos={transactionPhotos}
          missingObservationId={fieldErrors.missingObservationId}
          onPatch={onPatch}
        />
      )}

      {emptySections.length > 0 ? (
        <p
          className="mb-3 mt-0 rounded-lg border border-dashed border-border px-3 py-2 text-[11.5px] text-text-3"
          data-testid="ins-empty-sections"
        >
          لا شيء مسجّل في: {emptySections.join("، ")}.
        </p>
      ) : null}

      {/* The phone's key notes and client declaration — the inspector's own, never the review. */}
      {!serviceProofFromTransactionPhotos ? (
        <InsCard title="المفتاح وإقرار العميل">
          {keyAvailability ? (
            <InspectorKeyStatusNotes
              keyAvailability={keyAvailability}
              isLand={isLand}
              onRegisterFailure={editable ? onRegisterKeyFailure : undefined}
            />
          ) : null}
          <InspectorClientDeclarationField
            draft={draft}
            contacts={property.contacts}
            disabled={!editable}
            onPatch={onPatch}
          />
        </InsCard>
      ) : null}

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

      {flat ? submitFooter : null}
    </>
  );

  if (flat) {
    return (
      <div>
        {stepOne}
        {stepTwo}
        {stepThree}
      </div>
    );
  }

  const stepBody: Record<InspectorSectionId, ReactNode> = {
    "ins-step-1": stepOne,
    "ins-step-2": stepTwo,
    "ins-step-3": stepThree,
  };
  return (
    <WorkSectionsLayout
      sections={INSPECTOR_FRAME_SECTIONS}
      step={frameStep}
      state={frame}
      railLabel="أقسام المعاينة"
      // A section's body has no top padding of its own.
      body={(id) => <div className="pt-3">{stepBody[id]}</div>}
      footer={submitFooter}
      railAside={railAside}
    />
  );
}

export function InspectorWorkspaceSubmitFooter({
  draft,
  saving,
  confirmInvalid = false,
  submitDisabled = false,
  submitLabel = "حفظ وإرسال",
  confirmLabel = "أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني",
  confirmed,
  onConfirmedChange,
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
  /**
   * The specialist's own review tick. Without it the box shows the inspector's pledge
   * (`draft.inspectionConfirmed`), which is already ticked on a submitted package — so the
   * specialist's «راجعت…» opened pre-ticked (fixed 2026-10-28).
   */
  confirmed?: boolean;
  onConfirmedChange?: (checked: boolean) => void;
  onPatch: (patch: InspectorWorkspacePatchInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const checked = confirmed ?? draft.inspectionConfirmed;
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
          checked={checked}
          onChange={(e) =>
            onConfirmedChange
              ? onConfirmedChange(e.target.checked)
              : onPatch({ inspectionConfirmed: e.target.checked })
          }
        />
        {confirmLabel}
      </label>
      <span className="flex-1" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        loading={saving}
        disabled={saving || !checked || submitDisabled}
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
        كل بطاقة تُحفظ تلقائياً عند الإدخال — يمكنك تصفح الأقسام بحرية، والتحقق
        يتم عند الإرسال.
      </span>
      <span className="flex-1" />
      <Button type="button" variant="primary" size="sm" onClick={onContinue}>
        حفظ ومتابعة
      </Button>
    </div>
  );
}
