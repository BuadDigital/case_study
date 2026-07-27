"use client";

import { useState, type RefObject } from "react";
import { EngineeringSurveyPropertySummary } from "@engineering-office/mfe/components/EngineeringSurveyPropertySummary";
import { FailureRaisePanel } from "@failures/mfe";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { Note, cn } from "@platform/design-system";
import { PartyCaseStudyFormTab } from "../case-study/PartyCaseStudyFormTab";
import { PropertyTransactionTimeline } from "../po-intake/PropertyTransactionTimeline";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { InspectorFeesTab } from "./InspectorFeesTab";
import { InspectorKeyStatusTab } from "./InspectorKeyStatusTab";
import {
  FieldInspectionWorkBody,
  type FieldInspectionWorkHostRef,
} from "./FieldInspectionWorkBody";

type WorkTab = "property" | "inspection" | "key" | "fees" | "failures";

const workTabBtn =
  "mb-[-1px] flex shrink-0 items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text max-lg:min-h-11 max-lg:px-4 max-lg:text-[13px]";

function CaseStudyAside({
  def,
  task,
  forceReadOnly,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  forceReadOnly: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3 max-lg:rounded-none max-lg:border-x-0 max-lg:p-0">
      <button
        type="button"
        className={cn(
          "mb-2 flex w-full items-center justify-between gap-2 text-start font-inherit xl:pointer-events-none xl:cursor-default",
          "max-lg:mb-0 max-lg:min-h-12 max-lg:border-b max-lg:border-border max-lg:px-4 max-lg:py-3.5",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="m-0 text-sm font-semibold text-text">نموذج الدراسة</h3>
        <i
          className={cn(
            "ti text-sm text-text-3 xl:hidden",
            open ? "ti-chevron-up" : "ti-chevron-down",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "max-lg:px-3 max-lg:pb-3 xl:block",
          !open && "max-xl:hidden",
        )}
      >
        <PartyCaseStudyFormTab
          def={def}
          childTask={task}
          forceReadOnly={forceReadOnly}
        />
      </div>
    </section>
  );
}

export function FieldInspectionWorkPanel({
  def,
  task,
  hostRef,
  record,
  property,
  deedNumber,
  submitting = false,
  onFailureSubmitted,
  forceReadOnly = false,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  deedNumber: string;
  submitting?: boolean;
  onFailureSubmitted?: () => void;
  forceReadOnly?: boolean;
}) {
  const [workTab, setWorkTab] = useState<WorkTab>("inspection");
  const [keyFailureIntent, setKeyFailureIntent] = useState(false);

  function openKeyFailure() {
    setKeyFailureIntent(true);
    setWorkTab("failures");
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6 [&::-webkit-scrollbar]:h-0"
        aria-label="أقسام المهمة"
        role="tablist"
      >
        {(
          [
            ["property", "بيانات العقار"],
            ["inspection", def.workTitle],
            ["key", "المفتاح"],
            ["fees", "مالية المعاملة"],
            ["failures", "التعذرات"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={workTab === id}
            className={cn(
              workTabBtn,
              workTab === id && "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {workTab === "inspection" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 max-lg:overflow-y-auto max-lg:px-0 max-lg:py-0 sm:px-6 sm:py-5">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 max-lg:gap-0 xl:grid-cols-2">
            <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3 max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:p-0">
              <h3 className="m-0 mb-2 px-3 pt-3 text-sm font-semibold text-text max-lg:px-4 max-lg:pt-4 xl:px-0 xl:pt-0">
                {def.workTitle}
              </h3>
              <Note tone="info" className="mb-4 max-lg:mx-4 xl:mx-0">
                {def.workIntro}
              </Note>
              <div className="max-lg:px-0">
                <FieldInspectionWorkBody
                  def={def}
                  task={task}
                  hostRef={hostRef}
                  submitting={submitting}
                  onRegisterFailure={openKeyFailure}
                />
              </div>
            </section>
            <CaseStudyAside
              def={def}
              task={task}
              forceReadOnly={forceReadOnly}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-row items-stretch overflow-hidden max-lg:flex-col">
          <div className="order-1 min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {workTab === "property" ? (
              <EngineeringSurveyPropertySummary
                property={property}
                record={record}
              />
            ) : null}
            {workTab === "key" ? (
              <InspectorKeyStatusTab
                task={task}
                onRegisterKeyFailure={openKeyFailure}
              />
            ) : null}
            {workTab === "fees" ? (
              <InspectorFeesTab tasks={[task]} variant="field-inspection" />
            ) : null}
            {workTab === "failures" && task.propertyId ? (
              <div id="inspector-failure-raise" className="scroll-mt-4">
                <FailureRaisePanel
                  poNumber={task.poNumber}
                  propertyId={task.propertyId}
                  deedNumber={deedNumber}
                  specialist={task.assigneeName || def.assigneeSubtitle}
                  raisedByRole={failureRaiserRoleForParty(def)}
                  onSubmitted={() => {
                    setKeyFailureIntent(false);
                    onFailureSubmitted?.();
                  }}
                  autoOpenRaise={keyFailureIntent}
                  initialProblemTypeId={
                    keyFailureIntent ? "key-wont-open" : ""
                  }
                />
              </div>
            ) : null}
          </div>

          <PropertyTransactionTimeline record={record} property={property} />
        </div>
      )}
    </div>
  );
}
