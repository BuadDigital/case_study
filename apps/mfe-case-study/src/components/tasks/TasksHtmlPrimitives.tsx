"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/ui-kit";

/**
 * HTML primitives for المهام — Case Study.html `renderTasks` / `renderTaskDetail` /
 * `renderTaskNew` / `openCloseModal` / `openPauseModal` / `openPriorityModal` /
 * `openReassignModal` (primary: `_تصميم واجهة احترافية - المهام`).
 *
 * Layout tokens live in `ops-tasks-tw.ts`; this module holds shared chrome helpers.
 */

/** `renderTasks` COLS */
export const TASKS_LIST_COLS =
  "40px minmax(170px,1.8fr) minmax(110px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.2fr) minmax(84px,.85fr) 84px";

/** Case Study.html `.card` footer note under the grid. */
export const TASKS_LIST_FOOTER =
  "اضغط الصف لعرض تفاصيل المهمة. المراجعة الحكومية وخطاب التفويض حالتان من هذه الطبقة.";

/** Case Study.html `#tkShowAll` eye (static — no blink). */
export function TasksShowAllEye() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** KPI icon from `renderTasks` — منشأة (sun rays). */
export function TasksKpiCreatedIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
    </svg>
  );
}

/** KPI icon from `renderTasks` — قيد التنفيذ. */
export function TasksKpiInProgressIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** KPI icon from `renderTasks` — مكتملة. */
export function TasksKpiCompletedIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

/** KPI icon from `renderTasks` — مهام نشطة (clipboard check). */
export function TasksKpiActiveIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function TasksSectionNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-[11px] text-xs text-text-3">
      {children}
    </div>
  );
}

export function TasksEmptyRows({ message = "لا توجد مهام مطابقة." }: { message?: string }) {
  return (
    <div className="px-4 py-11 text-center text-[13.5px] text-text-3">{message}</div>
  );
}

export function tasksDescClassName(variant: "plain" | "gold" = "plain") {
  return cn(
    "mt-4 rounded-xl px-4 py-3.5 text-[13px] leading-[1.7]",
    variant === "gold"
      ? "border border-[color-mix(in_srgb,var(--gold)_45%,transparent)] border-s-[3px] border-s-gold-d bg-gold-soft text-heading"
      : "border border-border bg-surface-2 text-text",
  );
}
