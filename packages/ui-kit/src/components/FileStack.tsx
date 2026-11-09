"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type FileStackProps = {
  /** The files' names, oldest first — the count and the «آخرها» line come from here. */
  names: readonly string[];
  /** The full file rows, shown when the stack is open (or always, below `collapseFrom`). */
  children: ReactNode;
  /** From how many files the rows fold into the stack. @default 2 */
  collapseFrom?: number;
  /** What the «آخرها» line shows for the newest file — e.g. the name its uploader gave it. @default its name */
  newestLabel?: ReactNode;
  className?: string;
};

/**
 * A closed «bag» of attached files (Omar 2026-11-09: «instead of the scrolling i want like bag»).
 *
 * How it works: below `collapseFrom` files the rows show as they are. From there on the card shows
 * one row — a small pile of sheets, the count, the newest file's name and «عرض الملفات» — and the
 * rows open underneath at full height (no inner scroll) until «إخفاء» closes them again.
 * Edge cases: starts closed; the open/closed choice is the viewer's and survives new uploads, while
 * the summary line always names the newest file, so an upload is visible without opening the stack.
 */
export function FileStack({ names, children, collapseFrom = 2, newestLabel, className }: FileStackProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = names.length;
  if (count < collapseFrom) return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
  const newest = names[count - 1] ?? "";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-[10px] bg-surface-2 p-2 text-start transition-colors hover:bg-row-hover"
      >
        <span className="relative h-9 w-8 shrink-0" aria-hidden>
          {[2, 1, 0].map((depth) => (
            <span
              key={depth}
              className="absolute inset-0 rounded-[5px] border border-border-md bg-surface"
              style={{ transform: `translate(${-depth * 3}px, ${-depth * 3}px)`, opacity: 1 - depth * 0.2 }}
            />
          ))}
          <span className="absolute inset-x-1.5 top-2.5 h-[2px] rounded bg-border-md" />
          <span className="absolute inset-x-1.5 top-4 h-[2px] rounded bg-border-md" />
          <span className="absolute inset-x-1.5 top-[22px] h-[2px] w-3 rounded bg-border-md" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[12px] font-bold text-heading tabular-nums">{count} ملفات</span>
          <span className="truncate text-[10.5px] text-text-3" dir="auto" title={newest}>
            آخرها: {newestLabel ?? newest}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary">
          {open ? "إخفاء" : "عرض الملفات"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform duration-150", open && "rotate-180")}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
