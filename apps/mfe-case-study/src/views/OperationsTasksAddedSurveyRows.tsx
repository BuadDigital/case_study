"use client";

import { useMemo } from "react";
import { Badge, Td, TdAction, Tr } from "@platform/ui-kit";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { poPropertyCoordinationPath } from "@platform/app-shared/domain/po-routes";
import {
  ENGINEERING_SURVEY_TASK_TYPE,
  operationsTaskScopeLabel,
} from "../lib/app-data/operations-task-display";
import { opsRowMeta, opsRowTitle, opsTypeIconSm } from "../lib/app-data/ops-tasks-tw";
import { canRedistributeParties, canSkipEngineeringSurvey } from "../lib/app-data/po-roles";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { TypeIcon } from "./OperationsTasksViewShared";
import {
  ADDED_SURVEY_STATE_LABELS,
  ADDED_SURVEY_STATE_TONES,
  surveysAddedAfterDistribution,
  visibleAddedSurveys,
  type AddedSurveyRow,
  type AddedSurveyState,
} from "./operations-tasks-added-surveys";

/** The mobile card's status colour, as the operations tasks colour theirs. */
const STATE_COLOR: Record<AddedSurveyState, string> = {
  open: "#d9a441",
  delivered: "#102b4e",
  received: "#3f8f5f",
};

const TITLE = "رفع مساحي";
const ADDED_LINE = "مضاف بعد التوزيع";

/** Where a survey row leads: the transaction's «المكتب الهندسي» section; null without a deed. */
export function addedSurveyHref(row: AddedSurveyRow): string | null {
  const { task } = row;
  return task.propertyId ? poPropertyCoordinationPath(task.poNumber, task.propertyId, "survey") : null;
}

/**
 * The surveys added after the distribution, as the tasks table lists them (Omar 2026-11-12: «امسح
 * المربع… حطه في الجدول»).
 *
 * How it works: the shared workflow-task list (`surveysAddedAfterDistribution`), narrowed by the
 * table's own search, status and scope filters (`visibleAddedSurveys`).
 * Edge cases: only who adds the office or settles it sees them (coordination, the study, the section
 * supervisor and above) — everyone else gets none.
 */
export function useAddedSurveyRows(filters: {
  search: string;
  statusFilter: string;
  scopeFilter: string;
}): AddedSurveyRow[] {
  const { access } = useAppAccess();
  const { data: tasks = [] } = useWorkflowTasksQuery({ live: true });
  const mayFollow = canRedistributeParties(access) || canSkipEngineeringSurvey(access);
  const { search, statusFilter, scopeFilter } = filters;
  return useMemo(
    () =>
      mayFollow
        ? visibleAddedSurveys(surveysAddedAfterDistribution(tasks), { search, statusFilter, scopeFilter })
        : [],
    [mayFollow, tasks, search, statusFilter, scopeFilter],
  );
}

/**
 * One added survey as a row of the tasks table.
 *
 * How it works: the table's own columns — the task («رفع مساحي», «مضاف بعد التوزيع»), its link (the
 * deed and its work order), the office, and where the survey stands; the row opens the transaction
 * on its «المكتب الهندسي» section, where the office's work is received or the office skipped.
 * Edge cases: it is the office's survey task, not an operations task — so no checkbox, no reminder
 * and no ⋮ menu (pause, cancel and reassign do not apply), no due cell (the office's deadline is on
 * its own page), and it is not in the counters above the table.
 */
export function AddedSurveyTableRow({
  row,
  onOpen,
}: {
  row: AddedSurveyRow;
  onOpen: (href: string) => void;
}) {
  const { task, state } = row;
  const href = addedSurveyHref(row);
  return (
    <Tr
      role={href ? "button" : undefined}
      tabIndex={href ? 0 : undefined}
      className={href ? "cursor-pointer" : undefined}
      data-testid="tasks-added-survey-row"
      onClick={() => href && onOpen(href)}
      onKeyDown={(e) => {
        if (href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(href);
        }
      }}
    >
      <Td className="w-10" />
      <Td>
        <div className="flex min-w-0 items-center gap-[11px]">
          <span className={opsTypeIconSm}>
            <TypeIcon type={ENGINEERING_SURVEY_TASK_TYPE} size={15} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={opsRowTitle}>{TITLE}</span>
            <span className={opsRowMeta}>{ADDED_LINE}</span>
          </div>
        </div>
      </Td>
      <Td>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-text">
            {operationsTaskScopeLabel("transaction")}
          </span>
          <span dir="ltr" className="text-[11.5px] text-text-3">
            {task.deedNumber?.trim() || "—"} · {task.poNumber}
          </span>
        </div>
      </Td>
      <Td>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-heading">{task.assigneeName || "—"}</span>
          <span className="text-[11.5px] text-text-3">مكتب هندسي</span>
        </div>
      </Td>
      <Td className="text-text-3">—</Td>
      <Td className="text-center">
        <Badge tone={ADDED_SURVEY_STATE_TONES[state]}>{ADDED_SURVEY_STATE_LABELS[state]}</Badge>
      </Td>
      <TdAction />
    </Tr>
  );
}

/** The same rows as phone cards, ahead of the operations tasks' cards. */
export function addedSurveyMobileItems(
  rows: AddedSurveyRow[],
  onOpen: (href: string) => void,
): ActiveQueueMobileCardItem[] {
  return rows.map((row) => {
    const { task, state } = row;
    const href = addedSurveyHref(row);
    return {
      id: `survey:${task.id}`,
      title: `${TITLE} — ${ADDED_LINE}`,
      meta: [
        { text: task.deedNumber?.trim() || "—", kind: "plain" as const },
        { text: task.poNumber, kind: "po" as const },
        { text: task.assigneeName || "—", kind: "type" as const },
      ],
      statusLabel: ADDED_SURVEY_STATE_LABELS[state],
      statusStyle: { base: STATE_COLOR[state], fg: STATE_COLOR[state] },
      moreItems: [],
      onOpen: href ? () => onOpen(href) : undefined,
    };
  });
}
