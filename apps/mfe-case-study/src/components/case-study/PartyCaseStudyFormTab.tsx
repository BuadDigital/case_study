"use client";

import { InlineLoadingSkeleton, Note } from "@platform/design-system";
import { useMemo } from "react";
import { CaseStudyForm } from "./CaseStudyForm";
import { partyIdForRoleId } from "@settings/mfe";
import { findPropertyForTask } from "../../lib/prototype/my-task-row";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../../query/case-study-queries";

function resolveParentCaseStudyTask(
  task: WorkflowTask,
  all: WorkflowTask[],
): WorkflowTask | null {
  if (task.kind === "case-study-property") return task;
  if (task.parentTaskId) {
    const parent = all.find((t) => t.id === task.parentTaskId);
    if (parent) return parent;
  }
  return (
    all.find(
      (t) =>
        t.kind === "case-study-property" &&
        t.poNumber === task.poNumber &&
        t.propertyId === task.propertyId,
    ) ?? null
  );
}

export function PartyCaseStudyFormTab({
  def,
  childTask,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
}) {
  const partyId = partyIdForRoleId(def.roleId);
  const { data: tasks } = useWorkflowTasksQuery();
  const { data: record, isPending: recordLoading } = usePoRecordQuery(
    childTask.poNumber,
  );

  const parentTask = useMemo(
    () => resolveParentCaseStudyTask(childTask, tasks ?? []),
    [childTask, tasks],
  );

  const property = useMemo(
    () =>
      record && parentTask ? findPropertyForTask(record, parentTask) : null,
    [record, parentTask],
  );

  if (!partyId) {
    return (
      <Note tone="warn">
        لا يوجد طرف مطابق لهذا الدور في مصفوفة علاقة المستخدم بالمعلومة.
      </Note>
    );
  }

  if (recordLoading && !record) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  if (!parentTask) {
    return (
      <Note tone="warn">
        لم تُعثر على معاملة دراسة الحالة الأم لهذا العقار. أكمل التوزيع أولاً.
      </Note>
    );
  }

  return (
    <div>
      <CaseStudyForm
        taskId={childTask.id}
        task={parentTask}
        property={property}
        poRecord={record ?? undefined}
        requestDateSeed={record?.receivedFromEnfathAt}
        variant="party"
        partyId={partyId}
        partyChildTaskId={childTask.id}
        parentFormTaskId={parentTask.id}
      />
    </div>
  );
}
