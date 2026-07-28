"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { StatusPill, type StatusPillStyle, cn } from "@platform/design-system";

/**
 * HTML primitives for المراجعة الحكومية — Case Study.html `renderGovReview`
 * (primary: `_تصميم واجهة احترافية - الأظرف` / `_gov_keys_extract`).
 */

/** `renderGovReview` GCOLS */
export const GOV_REVIEW_LIST_COLS =
  "minmax(125px,1.2fr) minmax(105px,1fr) minmax(120px,1.1fr) 150px 150px 230px";

/** Case Study.html `.chip` */
export const govChipClassName =
  "inline-flex items-center gap-1 rounded-[6px] bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d";

/** Case Study.html reviewer badge in toolbar (gold soft). */
export const govReviewerBadgeClassName =
  "inline-flex items-center gap-1.5 rounded-[6px] bg-gold-soft px-[11px] py-[3px] text-[12px] font-bold text-gold-d";

/** Case Study.html `.card` */
export const govCardClassName =
  "rounded-xl border border-border bg-surface shadow-card";

/** Case Study.html `.ghost-btn` */
export const govGhostBtnClassName =
  "inline-flex h-[38px] cursor-pointer items-center gap-[7px] rounded-lg border border-border-md bg-surface px-[13px] text-[13px] font-medium text-text-2 transition-[border-color,color] duration-150 hover:border-gold hover:text-gold-d disabled:cursor-not-allowed disabled:opacity-60";

/** Compact row action — HTML `height:30px;padding:0 11px;font-size:12px`. */
export const govRowGhostBtnClassName =
  "inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-lg border border-border-md bg-surface px-[11px] text-[12px] font-medium transition-[border-color,color] duration-150 hover:border-gold disabled:cursor-not-allowed disabled:opacity-60";

/** Case Study.html `.primary` */
export const govPrimaryBtnClassName =
  "inline-flex cursor-pointer items-center gap-[7px] rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0";

/** Case Study.html queue footnote. */
export const GOV_REVIEW_LIST_FOOTER =
  "الإنهاء لا يُمنع عند غياب الظرف — تبقى شارة «بانتظار الظرف» وتتم مزامنة ناعمة مع الظرف إن وُجد.";

export function GovStatusPill({
  label,
  color,
  fg,
  live,
}: {
  label: string;
  /** Dot + tint base; amber gate uses separate fg via `fg`. */
  color: string;
  fg?: string;
  live?: boolean;
}) {
  const style: StatusPillStyle = {
    base: color,
    fg: fg ?? color,
    live,
  };
  return <StatusPill label={label} style={style} />;
}

export const GOV_STATUS_COLORS = {
  green: "#2f7a4d",
  amber: "#d9a441",
  amberFg: "#8a5e14",
} as const;

export function GovGridHead({
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

export function GovTh({
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

export function GovGridRow({
  cols,
  children,
  onClick,
  onContextMenu,
  muted,
  className,
  style,
  minHeight = 56,
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

export function GovTd({
  children,
  align = "start",
  className,
  col,
}: {
  children?: ReactNode;
  align?: "start" | "center";
  className?: string;
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

export function GovEmpty({
  message = "لا توجد عقارات مسجّلة بعد",
}: {
  message?: string;
}) {
  return (
    <div className="px-4 py-11 text-center text-[13.5px] text-text-3">
      <div className="font-semibold text-text-2">{message}</div>
    </div>
  );
}

/** Case Study.html `.sel` with caret. */
export function GovSelect({
  value,
  disabled,
  onChange,
  children,
  "aria-label": ariaLabel,
  "aria-busy": ariaBusy,
  className,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  "aria-label"?: string;
  "aria-busy"?: boolean | "true" | "false";
  className?: string;
}) {
  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <select
        aria-label={ariaLabel}
        aria-busy={ariaBusy || undefined}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full appearance-none rounded-lg border border-border-md bg-surface py-[7px] pe-[30px] ps-2.5 font-[inherit] text-[12.5px] text-text outline-none disabled:cursor-not-allowed disabled:opacity-60 max-lg:min-h-11 max-lg:text-[13px]"
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute end-[11px] grid place-items-center text-text-3"
        aria-hidden
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
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

export function GovKpiBuildingIcon() {
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
      <path d="M3 21h18M6 21V7l6-4 6 4M12 3v18" />
    </svg>
  );
}

export function GovKpiKeyIcon() {
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
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3" />
    </svg>
  );
}

export function GovKpiAlertIcon() {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function GovKpiCheckIcon() {
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

export function GovUserIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function GovPlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
