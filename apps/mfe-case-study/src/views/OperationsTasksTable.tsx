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
import {
  emptyQueueMessage,
  toggleVisibleActiveSelection,
} from "./operations-tasks-view-state";
import type { OperationsTasksWorkflow } from "./OperationsTasksViewShared";

export type OperationsTasksTableProps = Pick<
  OperationsTasksWorkflow,
  | "allVisibleActiveChecked"
  | "canRemind"
  | "isDesktopViewport"
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
>;

export function OperationsTasksTable({
  allVisibleActiveChecked,
  canRemind,
  isDesktopViewport,
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
}: OperationsTasksTableProps) {
  // Desktop table — after hydration mount only one tree (rendering).
  if (isDesktopViewport === false) return null;
  return (
    <TableFrame className="hidden lg:block">
      <Table wrapClassName="min-w-[900px]">
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
          {visibleTasks.length === 0 ? (
            <TableEmptyRow colSpan={7}>
              {emptyQueueMessage(useIndependentQueue)}
            </TableEmptyRow>
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
