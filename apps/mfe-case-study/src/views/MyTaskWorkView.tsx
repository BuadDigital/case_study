"use client";

/**
 * Case-study task work (Infath → bourse → distribution) — composition only.
 * State lives in `useMyTaskWorkWorkflow` and the commands in
 * `useMyTaskWorkCommands`; the terminal screens render from
 * `MyTaskWorkScreens`, the step cards from `MyTaskWorkSteps`, and the pure
 * step/screen decisions sit in `my-task-work-state`.
 */
import { Button, Note } from "@platform/ui-kit";
import { TaskWorkChrome } from "../components/primary-data/TaskWorkChrome";
import {
  FailureRaiseModal,
  preloadFailureRaiseModal,
} from "./MyTaskWorkLazyForms";
import { MyTaskWorkTerminalScreen } from "./MyTaskWorkScreens";
import {
  MyTaskWorkBourseStep,
  MyTaskWorkDistributionStep,
  MyTaskWorkEnfathStep,
} from "./MyTaskWorkSteps";
import { canRaiseFailure, taskWorkChromeTitle } from "./my-task-work-state";
import {
  useMyTaskWorkWorkflow,
  type CaseStudyTaskWorkProps,
} from "./useMyTaskWorkWorkflow";

export function CaseStudyTaskWork({
  task,
  onRefresh,
  layout = "page",
  onClose,
  onEnfathSaved,
}: CaseStudyTaskWorkProps) {
  const workflow = useMyTaskWorkWorkflow({
    task,
    onRefresh,
    layout,
    onClose,
    onEnfathSaved,
  });
  const {
    screen,
    steps,
    exit,
    property,
    deedTitle,
    panelDeedBadge,
    workSubtitle,
    submitBusy,
    showPrimarySave,
    saveLabel,
    handlePrimarySave,
    formError,
    failureModalOpen,
    setFailureModalOpen,
    failureSpecialist,
    failureRaisedByRole,
  } = workflow;

  if (screen !== "work") {
    return <MyTaskWorkTerminalScreen {...workflow} screen={screen} />;
  }

  return (
    <TaskWorkChrome
      layout={layout}
      title={taskWorkChromeTitle(steps, layout, deedTitle)}
      subtitle={workSubtitle}
      deedBadge={panelDeedBadge}
      saving={submitBusy}
      onClose={exit}
      onSave={showPrimarySave ? handlePrimarySave : exit}
      saveLabel={showPrimarySave ? saveLabel : "رجوع للمهام"}
      footerExtra={
        <>
          {canRaiseFailure(task, steps) ? (
            <Button
              type="button"
              variant="dangerOutline"
              size="sm"
              onClick={() => setFailureModalOpen(true)}
              onMouseEnter={preloadFailureRaiseModal}
              onFocus={preloadFailureRaiseModal}
            >
              تسجيل تعذر
            </Button>
          ) : null}
        </>
      }
    >
      {formError ? (
        <Note tone="warn" className="mb-3" role="alert">
          {formError}
        </Note>
      ) : null}

      {steps.showEnfathStep ? <MyTaskWorkEnfathStep {...workflow} /> : null}
      {steps.showBourseStep ? <MyTaskWorkBourseStep {...workflow} /> : null}
      {steps.showDistribution ? (
        <MyTaskWorkDistributionStep {...workflow} />
      ) : null}

      {task.propertyId && failureModalOpen ? (
        <FailureRaiseModal
          open={failureModalOpen}
          onClose={() => setFailureModalOpen(false)}
          poNumber={task.poNumber}
          propertyId={task.propertyId}
          deedNumber={property.deedNumber?.trim() ?? ""}
          specialist={failureSpecialist}
          raisedByRole={failureRaisedByRole}
          onSubmitted={() => {
            onRefresh();
            if (layout === "panel") exit();
          }}
        />
      ) : null}
    </TaskWorkChrome>
  );
}
