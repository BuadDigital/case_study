"use client";

/**
 * Step cards of `CaseStudyTaskWork`: Infath (primary data), bourse (with the
 * deed-vitality flow) and distribution. Each
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
  | "fieldPolicy"
  | "fieldErrors"
  | "patchProperty"
  | "replaceProperty"
>;

export function MyTaskWorkEnfathStep({
  task,
  layout,
  property,
  assignmentType,
  fieldPolicy,
  fieldErrors,
  patchProperty,
  replaceProperty,
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
          fieldPolicy={fieldPolicy}
          fieldErrors={fieldErrors}
          onPatch={patchProperty}
          onReplaceProperty={replaceProperty}
          poNumber={task.poNumber}
          excludePoNumber={task.poNumber}
          showStageNote={layout !== "panel"}
        />
      </div>
    </RegistrationFormCard>
  );
}

export function MyTaskWorkBourseStep({
  task,
  property,
  fieldErrors,
  patchProperty,
  deedVitality,
  setDeedVitality,
}: Pick<
  MyTaskWorkflow,
  | "task"
  | "property"
  | "fieldErrors"
  | "patchProperty"
  | "deedVitality"
  | "setDeedVitality"
>) {
  return (
    <RegistrationFormCard
      title="بيانات البورصة"
      subtitle="يمكن تعديلها هنا أو من استعلام البورصة"
    >
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
