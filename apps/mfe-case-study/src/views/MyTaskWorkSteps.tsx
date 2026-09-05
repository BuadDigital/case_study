"use client";

/**
 * Step cards of `CaseStudyTaskWork`: Infath (primary data), bourse (with the
 * bourse-inquiry fast path and the deed-vitality flow) and distribution. Each
 * card `Pick`s what it needs from the `useMyTaskWorkWorkflow` bag and wires
 * the next step's chunk preload on hover/focus.
 */
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  DistributionPartiesForm,
  PoPropertyBourseForm,
  PoPropertyEnfathForm,
  preloadDistributionPartiesForm,
  preloadPoPropertyBourseForm,
} from "./MyTaskWorkLazyForms";
import type { MyTaskWorkflow } from "./useMyTaskWorkWorkflow";

type PropertyFormProps = Pick<
  MyTaskWorkflow,
  | "task"
  | "layout"
  | "property"
  | "assignmentType"
  | "fieldErrors"
  | "patchProperty"
  | "replaceProperty"
  | "steps"
>;

export function MyTaskWorkEnfathStep({
  task,
  layout,
  property,
  assignmentType,
  fieldErrors,
  patchProperty,
  replaceProperty,
  steps,
}: PropertyFormProps) {
  return (
    <RegistrationFormCard
      title={layout === "panel" ? undefined : "بيانات إنفاذ (الصك)"}
      subtitle={
        layout === "panel" ? undefined : "البيانات الواردة من منصة إنفاذ"
      }
    >
      {/* Working the Infath step = next step is bourse — prefetch (bundle-preload). */}
      <div
        onMouseEnter={preloadPoPropertyBourseForm}
        onFocus={preloadPoPropertyBourseForm}
      >
        <PoPropertyEnfathForm
          property={property}
          assignmentType={assignmentType}
          fieldErrors={fieldErrors}
          onPatch={patchProperty}
          onReplaceProperty={replaceProperty}
          poNumber={task.poNumber}
          excludePoNumber={task.poNumber}
          fieldsMode={
            steps.bourseInquiryFastPath ? "bourse-inquiry-primary" : "all"
          }
          showStageNote={layout !== "panel"}
          hideBoursePathStatus={steps.bourseInquiryPanelOnly}
        />
      </div>
    </RegistrationFormCard>
  );
}

export function MyTaskWorkBourseStep({
  task,
  property,
  assignmentType,
  fieldErrors,
  patchProperty,
  replaceProperty,
  steps,
  deedVitality,
  setDeedVitality,
  obstructionReason,
  onObstructionReasonChange,
  obstructionReasonError,
}: Omit<PropertyFormProps, "layout"> &
  Pick<
    MyTaskWorkflow,
    | "deedVitality"
    | "setDeedVitality"
    | "obstructionReason"
    | "onObstructionReasonChange"
    | "obstructionReasonError"
  >) {
  const { bourseInquiryFastPath } = steps;
  return (
    <RegistrationFormCard
      title="بيانات البورصة"
      subtitle={
        bourseInquiryFastPath
          ? "استعلام البورصة — أكمل المعرف ثم بيانات البورصة"
          : "يمكن تعديلها هنا أو من استعلام البورصة"
      }
    >
      {bourseInquiryFastPath ? (
        <PoPropertyEnfathForm
          property={property}
          assignmentType={assignmentType}
          fieldErrors={fieldErrors}
          onPatch={patchProperty}
          onReplaceProperty={replaceProperty}
          poNumber={task.poNumber}
          excludePoNumber={task.poNumber}
          fieldsMode="bourse-inquiry-primary"
        />
      ) : null}
      {bourseInquiryFastPath ? (
        <hr className="my-4 border-0 border-t border-border" aria-hidden />
      ) : null}
      {/* Working the bourse step = next step is distribution — prefetch (bundle-preload). */}
      <div
        onMouseEnter={preloadDistributionPartiesForm}
        onFocus={preloadDistributionPartiesForm}
      >
        <PoPropertyBourseForm
          property={property}
          fieldErrors={fieldErrors}
          onPatch={patchProperty}
          poNumber={task.poNumber}
          showDeedVitalityFlow
          deedVitality={deedVitality}
          onDeedVitalityChange={setDeedVitality}
          obstructionReason={obstructionReason}
          onObstructionReasonChange={onObstructionReasonChange}
          obstructionReasonError={obstructionReasonError}
        />
      </div>
    </RegistrationFormCard>
  );
}

export function MyTaskWorkDistributionStep({
  layout,
  distribution,
  patchDistribution,
  showEngineering,
  engineeringHint,
}: Pick<
  MyTaskWorkflow,
  "layout" | "distribution" | "patchDistribution" | "showEngineering" | "engineeringHint"
>) {
  return (
    <RegistrationFormCard
      title={layout === "panel" ? undefined : "توزيع المعاملة على الأطراف"}
      subtitle={
        layout === "panel"
          ? undefined
          : "فعّل الطرف ثم اختر المسؤول — يمكن الإسناد لأكثر من طرف معاً"
      }
    >
      <DistributionPartiesForm
        distribution={distribution}
        onPatch={patchDistribution}
        showEngineering={showEngineering}
        engineeringHint={engineeringHint}
      />
    </RegistrationFormCard>
  );
}
