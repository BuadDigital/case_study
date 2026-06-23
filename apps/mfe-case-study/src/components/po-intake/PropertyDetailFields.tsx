"use client";

import type { ReactNode } from "react";
import { Badge, cn, emptyStateClassName } from "@platform/design-system";

/** LTR-isolated value display for deeds, dates, phones, etc. */
export const ltrValueClass = "inline [direction:ltr] [unicode-bidi:isolate]";

const fieldsGridCols: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FieldBox({
  label,
  value,
  ltr,
  span,
  children,
  emptyLabel = "غير محدد",
  link,
  href,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  span?: 2 | 3 | 4;
  children?: ReactNode;
  emptyLabel?: string;
  link?: boolean;
  href?: string;
}) {
  const trimmed = value?.trim() ?? "";
  const isEmpty = !trimmed && !children;
  const linkClass =
    link || href
      ? "cursor-pointer text-primary underline underline-offset-2"
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

  return (
    <div
      className={cn(
        "min-w-0 rounded-[var(--radius-DEFAULT)] bg-surface-2 px-3 py-2.5",
        span === 2 && "col-span-1 sm:col-span-2",
        span === 3 && "col-span-1 sm:col-span-3",
        span === 4 && "col-span-1 sm:col-span-4",
      )}
    >
      <div className="mb-0.5 text-[11px] text-text-2">{label}</div>
      {href && !isEmpty ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "break-words text-[13px] font-medium text-text no-underline",
            linkClass,
          )}
        >
          {content}
        </a>
      ) : (
        <div
          className={cn(
            "break-words text-[13px] font-medium text-text",
            isEmpty && "font-normal text-text-3",
            linkClass,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function FieldsGrid({
  cols = 3,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-2", fieldsGridCols[cols])}
    >
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
    <h3 className="my-5 mb-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-text-3 uppercase first:mt-0">
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
  return <hr className="my-[18px] border-0 border-t border-border" />;
}

const infoBoxTone: Record<
  "default" | "teal" | "amber" | "red",
  string
> = {
  default: "bg-surface-2 text-text-2",
  teal: "bg-teal-light text-teal-text",
  amber: "bg-amber-light text-amber-text",
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
        "mb-3 flex items-start gap-2.5 rounded-[var(--radius-DEFAULT)] px-4 py-3.5 text-[13px] leading-relaxed",
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
    <div className={cn("flex flex-col items-center justify-center gap-2 text-text-3", emptyStateClassName)}>
      {icon ? (
        <span className="mb-1 text-4xl leading-none" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="text-sm font-medium text-text-2">{title}</div>
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
        danger && "text-danger-text",
      )}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {label === "معاينة" ? "👁" : label === "تحميل" ? "⬇" : "🗑"}
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
    <Badge tone={badgeTone} className={cn("text-[11px] font-normal", className)}>
      {children}
    </Badge>
  );
}
