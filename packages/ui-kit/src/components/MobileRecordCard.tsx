"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "../lib/cn";
import { opsMobileCard } from "../lib/ops-chrome";

export type MobileRecordTone = "ink" | "gold" | "red" | "muted";

export type MobileRecordField = {
  label: string;
  value: ReactNode;
  /** Numbers, dates, IDs — isolated left-to-right so they never break mid-value. */
  ltr?: boolean;
  /** Take the whole row instead of half (long text). */
  wide?: boolean;
};

export type MobileRecordCardProps = {
  title: ReactNode;
  /** One muted line under the title (place, PO, party…). */
  subtitle?: ReactNode;
  /** Top-end slot — usually a `StatusPill` / `Badge`. */
  status?: ReactNode;
  /** Label/value pairs laid out two per row. */
  fields?: MobileRecordField[];
  /** Full-width button row at the bottom — the row's actions. */
  actions?: ReactNode;
  /** Free block between fields and actions (inline editors, notes). */
  children?: ReactNode;
  tone?: MobileRecordTone;
  /** Whole-card tap target (the table row's click). */
  onOpen?: () => void;
  className?: string;
};

const toneRail: Record<MobileRecordTone, string> = {
  ink: "border-s-[3px] border-s-ink",
  gold: "border-s-[3px] border-s-gold",
  red: "border-s-[3px] border-s-red",
  muted: "border-s-[3px] border-s-border-md",
};

/**
 * One table row, re-laid out for a phone: title + status on top, the columns as
 * labelled fields two per row, actions as full-width buttons at the bottom.
 * Render a list of these with `lg:hidden` next to the table with `max-lg:hidden`
 * (or switch on `useViewportDesktop()`). Not a shrunken table: no column ever
 * scrolls sideways or hides off-screen.
 */
export function MobileRecordCard({
  title,
  subtitle,
  status,
  fields,
  actions,
  children,
  tone,
  onOpen,
  className,
}: MobileRecordCardProps) {
  const interactive = Boolean(onOpen);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        interactive
          ? (e: KeyboardEvent<HTMLDivElement>) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      className={cn(
        opsMobileCard,
        "min-w-0",
        tone && toneRail[tone],
        interactive &&
          "cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.992] active:bg-row-hover",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold leading-snug text-heading">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[12.5px] leading-snug text-text-2">{subtitle}</div>
          ) : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>

      {fields && fields.length > 0 ? (
        <dl className="m-0 mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2.5">
          {fields.map((f) => (
            <div key={f.label} className={cn("min-w-0", f.wide && "col-span-2")}>
              <dt className="text-[11px] font-medium text-text-3">{f.label}</dt>
              <dd className="m-0 mt-0.5 text-[13px] font-semibold leading-snug text-text [overflow-wrap:anywhere]">
                {f.ltr ? (
                  <bdi dir="ltr" className="whitespace-nowrap tabular-nums">
                    {f.value}
                  </bdi>
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="mt-2.5">{children}</div> : null}

      {actions ? (
        <div
          className="mt-3 flex gap-2 [&>*]:min-h-10 [&>*]:flex-1 [&>*]:justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical stack of `MobileRecordCard`s with an empty state that stays on screen. */
export function MobileRecordList({
  children,
  empty,
  isEmpty,
  className,
}: {
  children: ReactNode;
  /** Message when there are no records. */
  empty?: ReactNode;
  isEmpty?: boolean;
  className?: string;
}) {
  if (isEmpty) {
    return (
      <div
        className={cn(
          "rounded-[14px] border border-dashed border-border-md bg-surface px-4 py-8 text-center text-[13px] text-text-3",
          className,
        )}
      >
        {empty}
      </div>
    );
  }
  return <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>{children}</div>;
}
