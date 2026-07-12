"use client";

import { Badge, cn } from "@platform/design-system";
import type { PoIntakeRecord } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import {
  governmentReviewTaskDeedLabel,
  governmentReviewTaskKindLabel,
  governmentReviewTaskRowTitle,
} from "./government-review-task-display";
import { GovernmentReviewSectionCard } from "./GovernmentReviewSectionCard";

export function GovernmentReviewPropertyTaskList({
  tasks,
  record,
  onOpenTask,
}: {
  tasks: WorkflowTask[];
  record?: PoIntakeRecord;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <GovernmentReviewSectionCard title="مهام المراجعة (حسب العقار)">
      {tasks.length === 0 ? (
        <p className="m-0 text-[13px] leading-relaxed text-text-3">
          لا توجد مهام مراجعة مرتبطة بهذا الأمر.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {tasks.map((task) => {
            const open = task.status === "open";
            const deed = governmentReviewTaskDeedLabel(task);
            const title = governmentReviewTaskRowTitle(task, record);
            const showSubtitle = title !== deed;

            return (
              <li key={task.id}>
                <button
                  type="button"
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 text-start transition-[border-color,background-color,box-shadow]",
                    "hover:border-primary/35 hover:bg-info-bg/35 hover:shadow-[0_1px_4px_rgba(15,23,42,0.06)]",
                  )}
                  onClick={() => onOpenTask(task.id)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-text tabular-nums"
                      dir="ltr"
                    >
                      {deed}
                    </span>
                    <span className="min-w-0">
                      {showSubtitle ? (
                        <span className="block truncate text-[13px] font-medium text-text">
                          {title}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "block truncate text-text-3",
                          showSubtitle ? "text-[11px]" : "text-[13px] font-medium text-text",
                        )}
                      >
                        {governmentReviewTaskKindLabel(task)}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={open ? "warning" : "success"}>
                      {open ? "قيد الإجراء" : "منجزة"}
                    </Badge>
                    <span
                      className="text-sm text-text-3 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    >
                      ‹
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GovernmentReviewSectionCard>
  );
}
