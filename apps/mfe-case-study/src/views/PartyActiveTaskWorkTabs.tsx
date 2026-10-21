"use client";

import { MobileSectionPicker, cn } from "@platform/ui-kit";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { FailureRaisePanel } from "@failures/mfe/components/failures/FailureRaisePanel";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";

const PARTY_FAILURE_RAISE_KINDS = new Set([
  "field-inspection",
  "property-appraisal",
  "engineering-survey",
]);

const WORK_TAB =
  "cursor-pointer border-none bg-transparent px-3.5 py-2.5 text-xs font-medium transition-[background-color,border-color,color] duration-200 ease-out hover:bg-surface-2 motion-reduce:transition-none";

export function PartyWorkTabs({
  workTab,
  workTitle,
  onSelect,
}: {
  workTab: "task" | "case-study";
  workTitle: string;
  onSelect: (tab: "task" | "case-study") => void;
}) {
  return (
    <>
    {/* Phones: a full-width segmented control (short labels so both fit side by side). */}
    <MobileSectionPicker
      className="mb-3 lg:hidden"
      title="أقسام المهمة"
      sections={[
        { id: "task", label: workTitle.length <= 14 ? workTitle : "المهمة" },
        { id: "case-study", label: "دراسة الحالة" },
      ]}
      active={workTab}
      onChange={(id) => onSelect(id as "task" | "case-study")}
    />
    <nav
      className="mb-3 overflow-hidden rounded-xl border border-border max-lg:hidden"
      aria-label="أقسام المهمة"
      role="tablist"
    >
      <div className="flex flex-wrap border-b border-border bg-surface">
        <button
          type="button"
          role="tab"
          aria-selected={workTab === "task"}
          className={cn(
            WORK_TAB,
            workTab === "task"
              ? "-mb-px border-b-2 border-b-primary font-semibold text-primary"
              : "text-text-2 hover:text-text",
          )}
          onClick={() => onSelect("task")}
        >
          {workTitle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workTab === "case-study"}
          className={cn(
            WORK_TAB,
            workTab === "case-study"
              ? "-mb-px border-b-2 border-b-primary font-semibold text-primary"
              : "text-text-2 hover:text-text",
          )}
          onClick={() => onSelect("case-study")}
        >
          تقرير دراسة الحالة
        </button>
      </div>
    </nav>
    </>
  );
}

export function PartyTaskFailureRaise({
  def,
  task,
  deedNumber,
  onSubmitted,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  deedNumber: string;
  onSubmitted?: () => void;
}) {
  if (!task.propertyId || !PARTY_FAILURE_RAISE_KINDS.has(task.kind)) {
    return null;
  }
  return (
    <FailureRaisePanel
      poNumber={task.poNumber}
      propertyId={task.propertyId}
      deedNumber={deedNumber}
      specialist={task.assigneeName || def.assigneeSubtitle}
      raisedByRole={failureRaiserRoleForParty(def)}
      onSubmitted={onSubmitted}
    />
  );
}
