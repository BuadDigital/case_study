"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { StatusPill, type StatusPillStyle, cn } from "@platform/ui-kit";

/** Case Study.html `.chip` */
export const keysChipClassName =
  "inline-flex items-center gap-1 rounded-[6px] bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d";

/** Case Study.html `.card` */
export const keysCardClassName =
  "rounded-xl border border-border bg-surface shadow-card";

/** Case Study.html `.pp-head` */
export const keysPpHeadClassName =
  "mb-[18px] rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-card";

/** Case Study.html `.panel-note` */
export const keysPanelNoteClassName =
  "rounded-xl border border-dashed border-border-md bg-surface px-[26px] py-[26px] text-center text-[13px] text-text-3";

/** Case Study.html `.ghost-btn` */
export const keysGhostBtnClassName =
  "inline-flex h-[38px] cursor-pointer items-center gap-[7px] rounded-lg border border-border-md bg-surface px-[13px] text-[13px] font-medium text-text-2 transition-[border-color,color] duration-150 hover:border-gold hover:text-gold-d disabled:cursor-not-allowed disabled:opacity-60";

/** Case Study.html `.primary` */
export const keysPrimaryBtnClassName =
  "inline-flex cursor-pointer items-center gap-[7px] rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0";

/** Case Study.html `.remind-btn` (compact) */
export const keysRemindBtnClassName =
  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-[9px] border-none bg-gold-d px-3.5 text-[12px] font-bold text-white shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--gold-d)_60%,transparent)] transition-[background,transform] hover:enabled:-translate-y-px hover:enabled:bg-gold disabled:opacity-60";

/** Case Study.html `.dash-card` */
export const keysDashCardClassName =
  "rounded-[14px] border border-border bg-surface px-5 py-4 shadow-card";

/** List COLS from `renderKeys` / `keyDrawList`. */
export const KEYS_LIST_COLS =
  "minmax(105px,.9fr) minmax(150px,1.4fr) 92px minmax(110px,1fr) 72px minmax(118px,1fr) minmax(120px,1fr) 44px";

/** Assignments COLS from `renderKeyDetail`. */
export const KEYS_ASSIGN_COLS =
  "minmax(112px,1fr) minmax(118px,1fr) minmax(105px,.95fr) 128px minmax(85px,.75fr) 218px";

/** Fees COLS from `renderKeyFees`. */
export const KEYS_FEES_COLS =
  "minmax(120px,1.1fr) minmax(150px,1.4fr) 110px 130px 150px";

export function KeysBackLink({
  onClick,
  children = "محفظة المفاتيح",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex cursor-pointer items-center gap-[7px] border-none bg-transparent p-0 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:text-gold-d"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-scale-x-100"
        aria-hidden
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>{children}</span>
    </button>
  );
}

export function KeysStatusPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  const style: StatusPillStyle = { base: color, fg: color };
  return <StatusPill label={label} style={style} />;
}

export function KeysTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 bg-transparent px-[15px] py-2.5 font-[inherit] text-[13px] font-semibold transition-[color,border-color]",
              on
                ? "border-gold text-gold-d"
                : "border-transparent text-text-2 hover:text-heading",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="ms-[5px] inline-flex rounded-full border border-border-md bg-surface-2 px-[7px] py-px text-[11px] text-text-3">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function KeysGridHead({
  cols,
  children,
  className,
}: {
  cols: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid border-b-2 border-gold bg-surface-2 text-[12px] font-bold text-heading",
        className,
      )}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function KeysTh({
  children,
  align = "center",
  className,
}: {
  children?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3.5",
        align === "start" ? "justify-start text-start" : "justify-center text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KeysGridRow({
  cols,
  children,
  onClick,
  onContextMenu,
  muted,
  className,
  style,
  minHeight = 58,
}: {
  cols: string;
  children: ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
  minHeight?: number;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "grid items-center border-b border-border transition-colors last:border-b-0",
        onClick && "cursor-pointer hover:bg-row-hover",
        muted && "opacity-55 saturate-[0.6]",
        className,
      )}
      style={{
        gridTemplateColumns: cols,
        minHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function KeysTd({
  children,
  align = "start",
  className,
  col,
}: {
  children?: ReactNode;
  align?: "start" | "center";
  className?: string;
  /** Stacked cell (court / circuit). */
  col?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden px-4 py-3.5",
        align === "center" && "justify-center",
        col && "flex-col items-start gap-0.5 justify-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KeysEmpty({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="px-5 py-[54px] text-center text-text-3">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mb-3 opacity-60"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <div className="text-[14px] font-bold text-text-2">{title}</div>
      <div className="mt-1 text-[13px]">{sub}</div>
    </div>
  );
}

export function KeysPpCell({
  label,
  children,
  first,
}: {
  label: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 min-w-0 flex-1 px-[18px]",
        first
          ? "border-s-0 ps-0"
          : "border-s border-border max-lg:border-s-0 max-lg:px-2",
      )}
    >
      <div className="mb-[3px] text-[11px] text-text-3">{label}</div>
      <div className="min-h-[22px] text-[13.5px] font-semibold text-heading">
        {children}
      </div>
    </div>
  );
}
