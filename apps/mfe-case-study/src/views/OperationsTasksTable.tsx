"use client";

/** Operations-tasks list — the desktop table (header select-all + memoised rows). */

import {
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { OperationsTaskRow } from "./OperationsTaskRow";
import { AddedSurveyTableRow } from "./OperationsTasksAddedSurveyRows";
import type { AddedSurveyRow } from "./operations-tasks-added-surveys";
import {
  emptyQueueMessage,
  toggleVisibleActiveSelection,
} from "./operations-tasks-view-state";
import type { OperationsTasksWorkflow } from "./OperationsTasksViewShared";

type OperationsTasksTableProps = Pick<
  OperationsTasksWorkflow,
  | "allVisibleActiveChecked"
  | "canRemind"
  | "isDesktopViewport"
  | "isPlaceholderData"
  | "openTask"
  | "openTaskDetail"
  | "remindTask"
  | "rowMenu"
  | "selAllRef"
  | "selectedIds"
  | "setSelectedIds"
  | "staffUsers"
  | "toggleTaskSelected"
  | "useIndependentQueue"
  | "visibleTasks"
> & {
  /** Surveys added after the distribution — listed ahead of the operations tasks (Omar 2026-11-12). */
  surveyRows?: AddedSurveyRow[];
  onOpenSurvey?: (href: string) => void;
};

export function OperationsTasksTable({
  allVisibleActiveChecked,
  canRemind,
  isDesktopViewport,
  isPlaceholderData,
  openTask,
  openTaskDetail,
  remindTask,
  rowMenu,
  selAllRef,
  selectedIds,
  setSelectedIds,
  staffUsers,
  toggleTaskSelected,
  useIndependentQueue,
  visibleTasks,
  surveyRows = [],
  onOpenSurvey,
}: OperationsTasksTableProps) {
  // Desktop table — after hydration mount only one tree (rendering).
  if (isDesktopViewport === false) return null;
  return (
    <TableFrame className="hidden lg:block">
      {/* Previous rows stay, dimmed, while a new filter / search slice loads. */}
      <Table wrapClassName="min-w-[900px]" pending={isPlaceholderData}>
        <THead>
          <Tr hoverable={false}>
            <ThAction aria-label="تحديد الكل" className="w-10">
              <input
                ref={selAllRef}
                type="checkbox"
                aria-label="تحديد الكل"
                className="size-[17px] accent-gold-d"
                checked={allVisibleActiveChecked}
                onChange={(e) =>
                  setSelectedIds(
                    toggleVisibleActiveSelection(
                      selectedIds,
                      visibleTasks,
                      e.target.checked,
                    ),
                  )
                }
              />
            </ThAction>
            <Th>المهمة</Th>
            <Th>النطاق / الربط</Th>
            <Th>المنفّذ</Th>
            <Th>الاستحقاق</Th>
            <Th className="text-center">الحالة</Th>
            <ThAction aria-label="إجراءات" />
          </Tr>
        </THead>
        <TBody>
          {surveyRows.map((row) => (
            <AddedSurveyTableRow
              key={`survey:${row.task.id}`}
              row={row}
              onOpen={(href) => onOpenSurvey?.(href)}
            />
          ))}
          {visibleTasks.length === 0 ? (
            // «لا توجد مهام» only when the table is really empty — a survey row is a row.
            surveyRows.length > 0 ? null : (
              <TableEmptyRow colSpan={7}>
                {emptyQueueMessage(useIndependentQueue)}
              </TableEmptyRow>
            )
          ) : (
            visibleTasks.map((task) => (
              <OperationsTaskRow
                key={task.id}
                task={task}
                checked={Boolean(selectedIds[task.id])}
                canRemind={canRemind}
                staffUsers={staffUsers}
                onOpen={openTask}
                onOpenDetail={openTaskDetail}
                onToggleSelect={toggleTaskSelected}
                onRemind={remindTask}
                rowMenu={rowMenu}
              />
            ))
          )}
        </TBody>
      </Table>
    </TableFrame>
  );
}
