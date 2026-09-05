"use client";

/**
 * Terminal screens of `CaseStudyTaskWork` — the states that replace the step
 * form entirely: loading, removed property, obstruction (with the supervisor's
 * release), case-study (read-only distribution), completed, and the
 * non-specialist notice. Each wraps `TaskWorkChrome` with a back/close footer.
 */
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { Button, InlineLoadingSkeleton, Note } from "@platform/ui-kit";
import { TaskWorkChrome } from "../components/primary-data/TaskWorkChrome";
import { formatPoDisplay } from "../lib/app-data/po-intake-data";
import { migrateDistribution } from "../lib/app-data/tasks-storage";
import { DistributionPartiesForm } from "./MyTaskWorkLazyForms";
import { removedPropertyNote, type TaskWorkScreen } from "./my-task-work-state";
import type { MyTaskWorkflow } from "./useMyTaskWorkWorkflow";

const LOADING_TEXT = "text-xs text-text-3";
const NOOP_DISTRIBUTION_PATCH = () => {};

type ScreenProps = Pick<
  MyTaskWorkflow,
  | "task"
  | "layout"
  | "exit"
  | "property"
  | "deedTitle"
  | "panelDeedBadge"
  | "workSubtitle"
  | "isSupervisor"
  | "showEngineering"
  | "engineeringHint"
  | "resolveObstruction"
  | "reviewFailures"
> & { screen: Exclude<TaskWorkScreen, "work"> };

export function MyTaskWorkTerminalScreen(props: ScreenProps) {
  const { screen, layout, exit, deedTitle, workSubtitle, panelDeedBadge } = props;

  if (screen === "loading") {
    return (
      <TaskWorkChrome
        layout={layout}
        title="تنفيذ المهمة"
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showFooter={false}
      >
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      </TaskWorkChrome>
    );
  }

  if (screen === "removed") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={deedTitle}
        subtitle={workSubtitle}
        onClose={exit}
        onSave={exit}
        saveLabel="إغلاق"
        showFooter
      >
        <Note tone="warn" className="mb-3" role="alert">
          {removedPropertyNote(props.property.removalReason)}
        </Note>
      </TaskWorkChrome>
    );
  }

  if (screen === "obstruction") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`تعذر — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        variant="detail"
        showFooter={false}
      >
        <ObstructionCard {...props} />
      </TaskWorkChrome>
    );
  }

  if (screen === "case-study") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`دراسة حالة — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع للمهام"
        variant="detail"
        showFooter={false}
      >
        <RegistrationFormCard title="دراسة حالة العقار">
          <Note tone="success" className="mb-3">
            تم تأكيد التوزيع وإرسال المهام للأطراف. المعاملة في مرحلة دراسة
            الحالة.
          </Note>
          <DistributionPartiesForm
            distribution={migrateDistribution(props.task.distribution)}
            onPatch={NOOP_DISTRIBUTION_PATCH}
            showEngineering={props.showEngineering}
            engineeringHint={props.engineeringHint}
            readOnly
          />
        </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  if (screen === "done") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`مهمة مكتملة — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع للمهام"
        variant="detail"
        showFooter={false}
      >
        <RegistrationFormCard title="المهمة مكتملة">
          <Note tone="success">
            اكتملت مهمة العقار. تم إرسال مهام فرعية للأطراف المختارين (إن وُجد).
          </Note>
        </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  return (
    <TaskWorkChrome
      layout={layout}
      title={deedTitle}
      subtitle={formatPoDisplay(props.task.poNumber)}
      deedBadge={panelDeedBadge}
      onClose={exit}
      onSave={exit}
      saveLabel="رجوع"
      variant="detail"
      showFooter={false}
    >
      <p className="w-full py-4 text-center text-xs text-text-3">
        هذه المهمة مخصصة لأخصائي دراسة الحالة.
      </p>
    </TaskWorkChrome>
  );
}

function ObstructionCard({
  task,
  isSupervisor,
  resolveObstruction,
  reviewFailures,
}: Pick<ScreenProps, "task" | "isSupervisor" | "resolveObstruction" | "reviewFailures">) {
  return (
    <RegistrationFormCard title="تعذر — بانتظار المشرف">
      <Note tone="warn" className="mb-3">
        {task.obstructionReason || "تم تسجيل تعذر على هذا العقار."}
      </Note>
      {isSupervisor ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" onClick={resolveObstruction}>
            إعادة للأخصائي
          </Button>
          <Button type="button" variant="default" onClick={reviewFailures}>
            مراجعة التعذرات
          </Button>
        </div>
      ) : (
        <p className="m-0 text-[13px] text-text-3">
          المهمة لدى المشرف حتى يُبت في التعذر.
        </p>
      )}
    </RegistrationFormCard>
  );
}
