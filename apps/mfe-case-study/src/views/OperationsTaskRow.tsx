"use client";

import { memo } from "react";
import { cn } from "@platform/ui-kit";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/prototype/operations-tasks-storage";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  operationsTaskLinkLabel,
  operationsTaskPriorityLabel,
  operationsTaskScopeLabel,
  operationsTaskTypeLabel,
} from "../lib/prototype/operations-task-display";
import { RowMoreMenu, type RowMoreMenuItem } from "../components/ui/RowMoreMenu";
import { TASKS_LIST_COLS } from "../components/tasks/TasksHtmlPrimitives";
import {
  opsGridRow,
  opsRemindMini,
  opsRowMeta,
  opsRowTitle,
  opsTd,
  opsTdC,
  opsTkCheck,
  opsTkCheckInput,
  opsTypeIconSm,
} from "../lib/prototype/ops-tasks-tw";
import {
  assigneeRoleLabel,
  BellIcon,
  DueCell,
  TaskStatusPill,
  TypeIcon,
} from "./OperationsTasksViewParts";

type OperationsTaskRowProps = {
  task: OperationsTask;
  checked: boolean;
  canRemind: boolean;
  staffUsers: StaffUser[];
  onOpen: (task: OperationsTask) => void;
  onOpenDetail: (task: OperationsTask) => void;
  onToggleSelect: (taskId: string, on: boolean) => void;
  onRemind: (task: OperationsTask) => void;
  rowMenu: (task: OperationsTask) => RowMoreMenuItem[];
};

// صف الجدول معزول بـ memo — كتابة نصوص المودالات في الشاشة الأم لا تعيد
// تصيير الصفوف ما دامت المعالجات ثابتة المرجع (rerender-memo).
export const OperationsTaskRow = memo(function OperationsTaskRow({
  task,
  checked,
  canRemind,
  staffUsers,
  onOpen,
  onOpenDetail,
  onToggleSelect,
  onRemind,
  rowMenu,
}: OperationsTaskRowProps) {
  const prColor = OPERATIONS_TASK_PRIORITY_COLORS[task.priority] ?? "#8a8d96";
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        opsGridRow,
        // الصفوف خارج الشاشة لا تُخطَّط ولا تُرسَم (rendering-content-visibility).
        "[content-visibility:auto] [contain-intrinsic-size:auto_52px]",
      )}
      style={{ gridTemplateColumns: TASKS_LIST_COLS }}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(task);
        }
      }}
    >
      <div
        className={cn(opsTd, opsTdC)}
        onClick={(e) => e.stopPropagation()}
      >
        {isActiveOperationsTask(task) ? (
          <label className={opsTkCheck}>
            <input
              type="checkbox"
              className={opsTkCheckInput}
              checked={checked}
              onChange={(e) => onToggleSelect(task.id, e.target.checked)}
            />
          </label>
        ) : null}
      </div>
      <div className={opsTd}>
        <div className="flex min-w-0 items-center gap-[11px]">
          <span className={opsTypeIconSm}>
            <TypeIcon type={task.type} size={15} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={opsRowTitle}>{task.title}</span>
            <span className={opsRowMeta}>
              <span dir="ltr">{task.displayId}</span>
              <span>·</span>
              <span>{operationsTaskTypeLabel(task.type)}</span>
              <span>·</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: prColor,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: prColor,
                  }}
                />
                {operationsTaskPriorityLabel(task.priority)}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className={opsTd}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-text">
            {operationsTaskScopeLabel(task.scope)}
          </span>
          <span dir="ltr" className="text-[11.5px] text-text-3">
            {operationsTaskLinkLabel(task)}
          </span>
        </div>
      </div>
      <div className={opsTd}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-heading">
            {task.assigneeName || task.assigneeId}
          </span>
          <span className="text-[11.5px] text-text-3">
            {assigneeRoleLabel(staffUsers, task.assigneeId)}
          </span>
        </div>
      </div>
      <div className={opsTd}>
        <DueCell task={task} />
      </div>
      <div className={cn(opsTd, opsTdC)}>
        <TaskStatusPill status={task.status} />
      </div>
      <div
        className={cn(opsTd, opsTdC)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full items-center justify-center gap-0.5">
          {canRemind && isActiveOperationsTask(task) ? (
            <button
              type="button"
              className={opsRemindMini}
              title="تذكير المنفّذ"
              aria-label="تذكير"
              onClick={() => void onRemind(task)}
            >
              <BellIcon size={16} />
            </button>
          ) : null}
          <RowMoreMenu items={rowMenu(task)} />
        </div>
      </div>
    </div>
  );
});
