"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, OperationalPanel } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { poPropertyCoordinationPath } from "@platform/app-shared/domain/po-routes";
import { canRedistributeParties, canSkipEngineeringSurvey } from "../lib/app-data/po-roles";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { TasksSectionNote } from "../components/tasks/TasksHtmlPrimitives";
import {
  ADDED_SURVEY_STATE_LABELS,
  surveysAddedAfterDistribution,
  type AddedSurveyState,
} from "./operations-tasks-added-surveys";

const STATE_TONE: Record<AddedSurveyState, "warning" | "primary" | "success"> = {
  open: "warning",
  delivered: "primary",
  received: "success",
};

/**
 * «رفع مساحي مضاف بعد التوزيع» — above the tasks table (Omar 2026-11-11: what is created from «مهمة
 * جديدة» is expected on this page). The rows are the office's own survey tasks, so they sit apart
 * from the operations-tasks table: its counters, pause, cancel and reminders do not apply to them.
 * Listing them as rows of the table itself was tried the same day and turned down.
 *
 * How it works: reads the shared workflow-task list and shows the surveys added after the
 * distribution (`surveysAddedAfterDistribution`); a row opens the transaction on its «المكتب الهندسي»
 * section, where the office's work is received or the office skipped.
 * Edge cases: shown to who adds the office or settles it (coordination, the study, the section
 * supervisor and above); renders nothing while there is no such survey.
 */
export function OperationsTasksAddedSurveys() {
  const router = useRouter();
  const { access } = useAppAccess();
  const { data: tasks = [] } = useWorkflowTasksQuery({ live: true });
  const rows = useMemo(() => surveysAddedAfterDistribution(tasks), [tasks]);
  const mayFollow = canRedistributeParties(access) || canSkipEngineeringSurvey(access);
  if (!mayFollow || rows.length === 0) return null;

  return (
    <OperationalPanel className="!rounded-[12px] p-0" data-testid="tasks-added-surveys">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="m-0 text-[13.5px] font-bold text-heading">رفع مساحي مضاف بعد التوزيع</h2>
        <Badge tone="default">{rows.length}</Badge>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map(({ task, state }) => (
          <li
            key={task.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-2.5 text-[13px]"
          >
            <span className="font-bold text-heading" dir="ltr">
              {task.deedNumber?.trim() || "—"}
            </span>
            <span className="text-[12px] text-text-3" dir="ltr">
              {task.poNumber}
            </span>
            <span className="font-semibold text-text">{task.assigneeName}</span>
            <Badge tone={STATE_TONE[state]}>{ADDED_SURVEY_STATE_LABELS[state]}</Badge>
            <span className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!task.propertyId}
              onClick={() =>
                task.propertyId &&
                router.push(poPropertyCoordinationPath(task.poNumber, task.propertyId, "survey"))
              }
            >
              فتح المعاملة
            </Button>
          </li>
        ))}
      </ul>
      <TasksSectionNote>
        مهام رفع مساحي لدى المكتب الهندسي — ليست ضمن جدول المهام أدناه ولا عدّاداته. يختفي الصف عند إصدار
        تقرير دراسة الحالة أو التجاوز عن المكتب.
      </TasksSectionNote>
    </OperationalPanel>
  );
}
