"use client";

/**
 * Inspector field-inspection form: composes the step cards around the
 * `useFieldInspectionWorkflow` bag. Each card lives in its own file; this
 * component only decides which cards apply (land vs building, boundaries
 * availability, desktop vs mobile chrome) and wires the shared state through.
 */
import { type ReactNode, type RefObject } from "react";

import { cn, InlineLoadingSkeleton, Note } from "@platform/ui-kit";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import {
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  isCommercialShopInspectionContext,
  isLandInspectionContext,
  visibleInspectorFeatureFields,
} from "../../lib/app-data/inspector-workspace-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";
export type { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";
import {
  InspectorDesktopActionBar,
  InspectorFormErrorNote,
  InspectorMapMoveModal,
} from "./FieldInspectionWorkChrome";
import { InspectorAccessPhotosCards } from "./InspectorAccessPhotosCards";
import { InspectorBoundariesCard } from "./InspectorBoundariesCard";
import { InspectorBuildingAreasCard } from "./InspectorBuildingAreasCard";
import { InspectorComponentsSection } from "./InspectorComponentsSection";
import {
  InspectorComparablesAndQuestionsCards,
  InspectorDefinedPhotosCard,
  InspectorDescriptionCard,
} from "./InspectorDescriptionDocsCards";
import { InspectorFeaturesSection } from "./InspectorFeaturesSection";
import { InspectorLocationCard } from "./InspectorLocationCard";
import { InspectorObservationsSection } from "./InspectorObservationsSection";
import { InspectorServicesCards } from "./InspectorServicesCards";
import { InspectorStepNav } from "./InspectorStepNav";
import { InspectorSubmitFooter } from "./InspectorSubmitFooter";
import { inspectionContextOf } from "./field-inspection-work-state";
import { useFieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function FieldInspectionWorkBody({
  def,
  task,
  hostRef,
  submitting = false,
  beforeSubmitFooter,
  onRegisterFailure,
  layout = "desktop",
  hideSubmitFooter = false,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  submitting?: boolean;
  beforeSubmitFooter?: ReactNode;
  onRegisterFailure?: () => void;
  layout?: "desktop" | "mobile";
  hideSubmitFooter?: boolean;
}) {
  const mobile = layout === "mobile";
  const workflow = useFieldInspectionWorkflow({ task, hostRef });
  const {
    activeStep,
    boundariesUnavailable,
    cancelPendingMapMove,
    confirmPendingMapMove,
    draft,
    errorLinks,
    fieldErrors,
    formError,
    keyAvailability,
    locked,
    pendingMapMove,
    persist,
    property,
    propertyId,
    role,
    saveDraft,
    scrollToErrorTarget,
    setActiveStep,
    showToast,
    workLocked,
  } = workflow;

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const photoStamp = inspectorPhotoStampText(draft);
  const photoCoverage = inspectorPhotoCoverageLabel(draft);
  const context = inspectionContextOf(draft, property);
  const isLandInspection = isLandInspectionContext(context);
  const isShopInspection = isCommercialShopInspectionContext(context);
  const featureFields = visibleInspectorFeatureFields(isLandInspection);
  const submitFromHost = () => void hostRef.current?.submit?.();
  const saveDraftFromHost = () => void saveDraft();

  return (
    <div className={cn(mobile ? "min-h-full bg-[var(--bg)] pb-2" : "pb-4")}>
      {locked ? (
        <Note tone="success" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          تم إرسال المعاينة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {draft.status === "reopened" && draft.returnNote?.trim() ? (
        <ReturnedForCorrectionNote
          note={draft.returnNote}
          className={cn("mb-4", mobile && "mx-4 mt-3")}
        />
      ) : null}

      {formError ? (
        <InspectorFormErrorNote
          errorLinks={errorLinks}
          formError={formError}
          mobile={mobile}
          scrollToErrorTarget={scrollToErrorTarget}
        />
      ) : null}

      <InspectorStepNav
        activeStep={activeStep}
        onSelect={setActiveStep}
        className={cn(mobile && "mx-4")}
      />

      <fieldset
        disabled={workLocked}
        className={cn(
          "m-0 min-w-0 border-0 p-0 [&_*]:min-w-0",
          workLocked &&
            "pointer-events-none select-none rounded-[10px] bg-[#F1F5F9] p-3 opacity-70 grayscale-[0.35]",
        )}
      >
        <InspectorLocationCard
          {...workflow}
          draft={draft}
          layout={layout}
          mobile={mobile}
        />

        <InspectorFeaturesSection
          activeStep={activeStep}
          cardLayout={layout}
          draft={draft}
          featureFields={featureFields}
          fieldErrors={fieldErrors}
          isLandInspection={isLandInspection}
          layout={layout}
          locked={locked}
          mobile={mobile}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
        />

        <InspectorAccessPhotosCards
          {...workflow}
          draft={draft}
          layout={layout}
          mobile={mobile}
        />

        {!isLandInspection ? (
        <InspectorComponentsSection
          activeStep={activeStep}
          cardLayout={layout}
          draft={draft}
          fieldErrors={fieldErrors}
          isShopInspection={isShopInspection}
          layout={layout}
          locked={locked}
          mobile={mobile}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
        />
        ) : null}

        <InspectorBuildingAreasCard
          {...workflow}
          draft={draft}
          isLandInspection={isLandInspection}
          layout={layout}
          mobile={mobile}
          poNumber={task.poNumber}
        />

        {!boundariesUnavailable && property ? (
          <InspectorBoundariesCard
            {...workflow}
            draft={draft}
            layout={layout}
            mobile={mobile}
            property={property}
          />
        ) : null}

        <InspectorServicesCards
          {...workflow}
          draft={draft}
          layout={layout}
          mobile={mobile}
        />

        <InspectorDescriptionCard
          {...workflow}
          draft={draft}
          layout={layout}
          mobile={mobile}
        />

        <InspectorDefinedPhotosCard
          {...workflow}
          draft={draft}
          layout={layout}
          mobile={mobile}
          photoCoverage={photoCoverage}
        />

        <InspectorObservationsSection
          activeStep={activeStep}
          cardLayout={layout}
          draft={draft}
          fieldErrors={fieldErrors}
          keyAvailability={keyAvailability}
          layout={layout}
          locked={locked}
          mobile={mobile}
          onRegisterFailure={onRegisterFailure}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
          showToast={showToast}
        />

        <InspectorComparablesAndQuestionsCards
          {...workflow}
          def={def}
          draft={draft}
          layout={layout}
          mobile={mobile}
          task={task}
        />

        {beforeSubmitFooter}

        {!mobile && !locked ? (
          <InspectorDesktopActionBar
            onRegisterFailure={onRegisterFailure}
            onSaveDraft={saveDraftFromHost}
            onSubmit={submitFromHost}
            submitting={submitting}
            workLocked={workLocked}
          />
        ) : null}

        {!hideSubmitFooter ? (
          <InspectorSubmitFooter
            disabled={workLocked}
            saving={submitting}
            locked={workLocked}
            onRegisterFailure={onRegisterFailure}
            onSaveDraft={saveDraftFromHost}
            onSubmit={submitFromHost}
          />
        ) : null}
      </fieldset>
      <InspectorMapMoveModal
        open={Boolean(pendingMapMove)}
        onCancel={cancelPendingMapMove}
        onConfirm={confirmPendingMapMove}
      />
    </div>
  );
}
