"use client";

import type { ReactNode } from "react";
import { Badge, cn, emptyStateClassName } from "@platform/design-system";

/** LTR-isolated value display for deeds, dates, phones, etc. */
export const ltrValueClass = "inline [direction:ltr] [unicode-bidi:isolate]";

const fieldsGridCols: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Soft gold field cell — matches Case Study.html `fieldBox`
 * (label above, value below; not a side-by-side table row).
 */
export function FieldBox({
  label,
  value,
  ltr,
  span,
  children,
  emptyLabel = "—",
  link,
  href,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  span?: 2 | 3 | 4;
  children?: ReactNode;
  /** Case Study.html `fieldBox` uses `v||'—'`. */
  emptyLabel?: string;
  link?: boolean;
  href?: string;
}) {
  const trimmed = value?.trim() ?? "";
  const isEmpty = !trimmed && !children;
  const linkClass =
    link || href
      ? "cursor-pointer text-[#8c7857] underline underline-offset-[3px]"
      : "";

  const content =
    children ??
    (isEmpty ? (
      emptyLabel
    ) : ltr ? (
      <bdi dir="ltr" className={ltrValueClass}>
        {trimmed}
      </bdi>
    ) : (
      trimmed
    ));

  const valueClass = cn(
    "text-[12.5px] font-semibold leading-snug text-text break-words",
    isEmpty && "font-normal text-text-3",
    ltr && !children && "text-end [direction:ltr]",
    linkClass,
  );

  return (
    <div
      className={cn(
        "min-w-0 rounded-[4px] bg-[color-mix(in_srgb,#f1ece2_45%,transparent)] px-3.5 py-2.5",
        span === 2 && "col-span-1 sm:col-span-2",
        span === 3 && "col-span-1 sm:col-span-3",
        span === 4 && "col-span-1 sm:col-span-2 lg:col-span-4",
      )}
    >
      <div className="mb-[3px] text-[10.5px] leading-snug text-text-3">
        {label}
      </div>
      {href && !isEmpty ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(valueClass, "no-underline")}
        >
          {content}
        </a>
      ) : (
        <div className={valueClass}>{content}</div>
      )}
    </div>
  );
}

export function FieldsGrid({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-[10px]", fieldsGridCols[cols])}>
      {children}
    </div>
  );
}

export function SectionHeader({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <h3 className="mb-2.5 mt-[18px] flex items-center gap-1.5 text-[13px] font-bold text-heading first:mt-0">
      {icon ? (
        <span className="inline-flex items-center opacity-75" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </h3>
  );
}

export function SectionDivider() {
  return <div className="h-0" aria-hidden />;
}

const infoBoxTone: Record<"default" | "teal" | "amber" | "red", string> = {
  default: "bg-surface-2 text-text-2",
  teal: "border border-[color-mix(in_srgb,#3f8f5f_26%,transparent)] bg-[color-mix(in_srgb,#3f8f5f_8%,transparent)] text-[#2f7a4d]",
  amber:
    "border border-[#fad7a0] bg-[#fef3d7] text-[#7a5b12]",
  red: "bg-danger-bg text-danger-text",
};

export function InfoBox({
  variant = "default",
  icon,
  children,
}: {
  variant?: "default" | "teal" | "amber" | "red";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed",
        infoBoxTone[variant],
      )}
    >
      {icon ? (
        <span className="mt-px shrink-0 text-base opacity-85" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function EmptyState({
  title,
  sub,
  icon,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-4 py-9 text-text-3",
        emptyStateClassName,
      )}
    >
      {icon ? (
        <span className="mb-1 text-4xl leading-none" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="text-[13.5px] font-bold text-text-2">{title}</div>
      {sub ? <div className="text-xs leading-snug">{sub}</div> : null}
    </div>
  );
}

export function ProgressBar({
  label,
  pct,
  tone = "teal",
}: {
  label: string;
  pct: number;
  tone?: "teal" | "amber" | "red";
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillClass =
    tone === "amber"
      ? "bg-warning"
      : tone === "red"
        ? "bg-danger"
        : "bg-success";

  return (
    <div className="mb-2 rounded-[var(--radius-DEFAULT)] bg-surface-2 px-4 py-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-text">{label}</span>
        <span className="text-xs text-text-2">{clamped}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-border">
        <div
          className={cn("h-full rounded transition-[width] duration-300", fillClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function DocIconButton({
  label,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border bg-surface p-0 text-sm text-text-2 outline-none transition-colors hover:bg-border hover:text-text",
        "max-lg:h-11 max-lg:min-w-11 max-lg:gap-1.5 max-lg:px-3 max-lg:w-auto max-lg:text-[12px] max-lg:font-semibold",
        danger && "text-danger-text",
        disabled && "cursor-not-allowed opacity-45",
      )}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden>
        {label === "معاينة" ? "👁" : label === "تحميل" ? "⬇" : "🗑"}
      </span>
      <span className="hidden max-lg:inline">{label}</span>
    </button>
  );
}

/** Small status badge used across property detail panels. */
export function DetailBadge({
  tone = "teal",
  children,
  className,
}: {
  tone?: "teal" | "amber" | "red" | "blue" | "gray";
  children: ReactNode;
  className?: string;
}) {
  const badgeTone =
    tone === "teal"
      ? "primary"
      : tone === "amber"
        ? "warning"
        : tone === "red"
          ? "danger"
          : tone === "blue"
            ? "info"
            : "default";

  return (
    <Badge tone={badgeTone} className={cn("text-[10.5px] font-bold", className)}>
      {children}
    </Badge>
  );
}
