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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6 [&::-webkit-scrollbar]:h-0"
        aria-label="أقسام المهمة"
        role="tablist"
      >
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "property" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("property")}
        >
          بيانات العقار
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "inspection" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("inspection")}
        >
          {def.workTitle}
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "key" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("key")}
        >
          المفتاح
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "fees" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("fees")}
        >
          مالية المعاملة
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "failures" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("failures")}
        >
          التعذرات
        </button>
      </nav>

      {workTab === "inspection" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3">
              <h3 className="m-0 mb-2 text-sm font-semibold text-text">
                {def.workTitle}
              </h3>
              <Note tone="info" className="mb-4">
                {def.workIntro}
              </Note>
              <FieldInspectionWorkBody
                def={def}
                task={task}
                hostRef={hostRef}
                submitting={submitting}
                onRegisterFailure={() => setWorkTab("failures")}
              />
            </section>
            <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3">
              <h3 className="m-0 mb-2 text-sm font-semibold text-text">
                نموذج الدراسة
              </h3>
              <PartyCaseStudyFormTab
                def={def}
                childTask={task}
                forceReadOnly={forceReadOnly}
              />
            </section>
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
            {workTab === "key" ? <InspectorKeyStatusTab task={task} /> : null}
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
                  onSubmitted={onFailureSubmitted}
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
