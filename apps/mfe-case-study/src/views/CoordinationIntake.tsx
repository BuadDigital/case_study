"use client";

/**
 * The coordinator page's intake block (Omar 2026-11-08): «البيانات الأولية + استعلام البورصة + التوزيع»
 * are worked in the page's first three sections, one after the other, with no «إحالة» between them.
 *
 * Two owners of the deed's intake data exist and must never run together on the page:
 * - while the transaction is in intake, the step workflow (`useMyTaskWorkWorkflow`, the same one the
 *   old primary-data / distribution panels used) holds the property draft, its autosave and the
 *   step's save-and-advance;
 * - once distributed, the in-place intake editor (`usePropertyIntakeEditor`, as on «تعديل العقار»).
 * `IntakeScope` mounts exactly one of them and hands it to the section bodies through context.
 */
import { createContext, useContext, type ReactNode } from "react";
import { Button, Note } from "@platform/ui-kit";
import {
  PropertyIntakeBourseCard,
  PropertyIntakeEnfathCard,
  usePropertyIntakeEditor,
  type PropertyIntakeEditor,
} from "../components/po-intake/PropertyIntakeEditorCards";
import type { WorkflowTask } from "../lib/app-data/tasks";
import {
  FailureRaiseModal,
  preloadFailureRaiseModal,
} from "./MyTaskWorkLazyForms";
import {
  MyTaskWorkBourseStep,
  MyTaskWorkDistributionStep,
  MyTaskWorkEnfathStep,
} from "./MyTaskWorkSteps";
import {
  activeTaskWorkStep,
  BOURSE_SAVE_ACTION,
  canRaiseFailure,
  DISTRIBUTION_CONFIRM_ACTION,
  removedPropertyNote,
} from "./my-task-work-state";
import {
  useMyTaskWorkWorkflow,
  type MyTaskWorkflow,
} from "./useMyTaskWorkWorkflow";

export type IntakeStep = "enfath" | "bourse" | "distribution";

const STEP_ORDER: Record<IntakeStep, number> = {
  enfath: 0,
  bourse: 1,
  distribution: 2,
};

const SAVE_LABEL: Record<IntakeStep, string> = {
  enfath: "حفظ وإكمال البيانات الأولية",
  bourse: BOURSE_SAVE_ACTION,
  distribution: DISTRIBUTION_CONFIRM_ACTION,
};

type IntakeScopeValue =
  | { mode: "steps"; workflow: MyTaskWorkflow }
  | { mode: "editor"; editor: PropertyIntakeEditor }
  | { mode: "none" };

const IntakeScopeContext = createContext<IntakeScopeValue>({ mode: "none" });

function StepsScope({
  task,
  onRefresh,
  children,
}: {
  task: WorkflowTask;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const workflow = useMyTaskWorkWorkflow({
    task,
    onRefresh,
    layout: "panel",
    onClose: () => undefined,
  });
  return (
    <IntakeScopeContext.Provider value={{ mode: "steps", workflow }}>
      {children}
      {task.propertyId && workflow.failureModalOpen ? (
        <FailureRaiseModal
          open={workflow.failureModalOpen}
          onClose={() => workflow.setFailureModalOpen(false)}
          poNumber={task.poNumber}
          propertyId={task.propertyId}
          deedNumber={workflow.property.deedNumber?.trim() ?? ""}
          specialist={workflow.failureSpecialist}
          raisedByRole={workflow.failureRaisedByRole}
          onSubmitted={onRefresh}
        />
      ) : null}
    </IntakeScopeContext.Provider>
  );
}

function EditorScope({
  poNumber,
  propertyId,
  children,
}: {
  poNumber: string;
  propertyId: string;
  children: ReactNode;
}) {
  const editor = usePropertyIntakeEditor({ poNumber, propertyId });
  return (
    <IntakeScopeContext.Provider value={{ mode: "editor", editor }}>
      {children}
    </IntakeScopeContext.Provider>
  );
}

/**
 * Mounts the one owner of the deed's intake data for the page.
 *
 * How it works: in intake (`intakeActive` with the deed's task) → the step workflow; past it, when the
 * viewer may edit the data → the in-place editor; otherwise nothing (the sections link to the details).
 * Edge cases: the switch from steps to editor (distribution confirmed) remounts the page's sections
 * once — the step workflow flushes its autosave as it unmounts.
 */
export function IntakeScope({
  task,
  intakeActive,
  mayEditData,
  poNumber,
  propertyId,
  onRefresh,
  children,
}: {
  task: WorkflowTask | null;
  intakeActive: boolean;
  mayEditData: boolean;
  poNumber: string;
  propertyId: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  if (intakeActive && task) {
    return (
      <StepsScope task={task} onRefresh={onRefresh}>
        {children}
      </StepsScope>
    );
  }
  if (mayEditData) {
    return (
      <EditorScope poNumber={poNumber} propertyId={propertyId}>
        {children}
      </EditorScope>
    );
  }
  return (
    <IntakeScopeContext.Provider value={{ mode: "none" }}>
      {children}
    </IntakeScopeContext.Provider>
  );
}

/** True while the step workflow owns the intake sections. */
export function useIntakeStepsActive(): boolean {
  return useContext(IntakeScopeContext).mode === "steps";
}

/**
 * The intake block's state above the sections: a stopped transaction (failure), a removed property,
 * or a viewer who cannot work the step. Nothing while the steps can be worked.
 */
export function CoordinationIntakeBanner() {
  const scope = useContext(IntakeScopeContext);
  if (scope.mode !== "steps") return null;
  const { workflow } = scope;
  switch (workflow.screen) {
    case "removed":
      return (
        <Note tone="danger" className="mb-3">
          {removedPropertyNote(workflow.property.removalReason ?? "")}
        </Note>
      );
    case "obstruction":
      return (
        <Note tone="warn" className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              المعاملة متوقفة بتعذّر — يتابعه التنسيق في «التعذّرات»، وتعود الخطوة هنا بعد معالجته.
            </span>
            {workflow.isSupervisor ? (
              <Button type="button" size="sm" variant="outline" onClick={workflow.resolveObstruction}>
                إعادة المهمة للأخصائي
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={workflow.reviewFailures}>
              فتح التعذّرات
            </Button>
          </div>
        </Note>
      );
    case "not-specialist":
      // Omar 2026-11-08: the three sub-roles share the data and edit it alike — only the step's
      // save-and-advance stays coordination's.
      return (
        <Note tone="info" className="mb-3">
          {workflow.isSpecialist
            ? "البيانات يعدّلها كل أخصائي وتُحفظ تلقائيًا — «حفظ وإكمال» الخطوة لأخصائي التنسيق."
            : "إدخال المعاملة لأخصائي التنسيق — تظهر لك البيانات بعد إدخالها في «تفاصيل العقار»."}
        </Note>
      );
    default:
      return null;
  }
}

/**
 * One intake section's body.
 *
 * How it works: in intake, the steps up to the current one show their forms (an earlier step stays
 * editable — the same draft and autosave); the current one ends with its save-and-advance button,
 * the form's error and, from the bourse on, «تسجيل تعذّر»; a later step shows `notYet`. Past intake,
 * the primary data and the bourse are the in-place editor cards; anything else is `fallback`.
 * Edge cases: a stopped / removed / not-allowed transaction shows only the banner's explanation;
 * the distribution past intake is the page's own read-only view (`fallback`).
 */
export function CoordinationIntakeBody({
  step,
  notYet,
  fallback,
}: {
  step: IntakeStep;
  notYet: string;
  fallback: ReactNode;
}) {
  const scope = useContext(IntakeScopeContext);

  if (scope.mode === "editor") {
    if (step === "distribution") return <>{fallback}</>;
    const { editor } = scope;
    return (
      <div className="flex flex-col gap-3 pt-3">
        {editor.formError ? <Note tone="warn">{editor.formError}</Note> : null}
        {editor.loading ? (
          <p className="m-0 text-[12px] text-text-3">جارٍ التحميل…</p>
        ) : step === "enfath" ? (
          <PropertyIntakeEnfathCard editor={editor} />
        ) : (
          <PropertyIntakeBourseCard editor={editor} />
        )}
      </div>
    );
  }
  if (scope.mode === "none") return <>{fallback}</>;

  const { workflow } = scope;
  if (workflow.screen === "loading") {
    return <p className="m-0 pt-3 text-[12px] text-text-3">جارٍ التحميل…</p>;
  }
  // A case specialist of another sub-role sees and edits the same forms (autosaved); the step's button
  // is not offered to him (`showPrimarySave` follows the coordination sub-role).
  const sharedView = workflow.screen === "not-specialist" && workflow.isSpecialist;
  if (workflow.screen !== "work" && !sharedView) {
    return <p className="m-0 pt-3 text-[12.5px] text-text-3">انظر الملاحظة أعلى الصفحة.</p>;
  }
  const active = activeTaskWorkStep(workflow.steps);
  const current = active ? STEP_ORDER[active] : 3;
  if (STEP_ORDER[step] > current) {
    return <p className="m-0 pt-3 text-[12.5px] text-text-3">{notYet}</p>;
  }
  const isCurrent = active === step;
  return (
    <div className="flex flex-col gap-3 pt-3">
      {step === "enfath" ? <MyTaskWorkEnfathStep {...workflow} /> : null}
      {step === "bourse" ? <MyTaskWorkBourseStep {...workflow} /> : null}
      {step === "distribution" ? <MyTaskWorkDistributionStep {...workflow} /> : null}
      {isCurrent ? (
        <>
          {workflow.formError ? (
            <Note tone="warn" role="alert">
              {workflow.formError}
            </Note>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {workflow.showPrimarySave ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={workflow.submitBusy}
                disabled={workflow.submitBusy}
                onClick={workflow.handlePrimarySave}
                data-testid={`coordination-intake-save-${step}`}
              >
                {SAVE_LABEL[step]}
              </Button>
            ) : null}
            {canRaiseFailure(workflow.task, workflow.steps) ? (
              <Button
                type="button"
                variant="dangerOutline"
                size="sm"
                onClick={() => workflow.setFailureModalOpen(true)}
                onMouseEnter={preloadFailureRaiseModal}
                onFocus={preloadFailureRaiseModal}
              >
                تسجيل تعذّر
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
