import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  emptyStateClassName,
  operationalPageBodyClassName,
  operationalPanelClassName,
  pageBodyClassName,
  pageGutterClassName,
  pageShellHeaderClassName,
  pageToolbarClassName,
  queueTableHintClassName,
} from "../lib/page-layout-classes";

export {
  emptyStateClassName,
  operationalPageBodyClassName,
  operationalPanelClassName,
  pageBodyClassName,
  pageGutterClassName,
  pageShellHeaderClassName,
  pageToolbarClassName,
  statCardFlushClassName,
  statGridFlushClassName,
  queueTableHintClassName,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  queueTableWrapClassName,
  workspaceStickyPanelMaxHClassName,
} from "../lib/page-layout-classes";

/** Full-width flat page shell (replaces `.page-shell`). */
export function PageShell({
  className,
  variant = "sheet",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** `canvas` — gray KPI-style background; `sheet` — full white surface. */
  variant?: "sheet" | "canvas";
}) {
  return (
    <div
      className={cn(
        "w-full rounded-none border-none shadow-none",
        variant === "sheet" &&
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-surface",
        variant === "canvas" && operationalPageBodyClassName,
        className,
      )}
      {...props}
    />
  );
}

/** White bordered panel on the operational canvas (tables, queues, forms). */
export function OperationalPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(operationalPanelClassName, className)} {...props} />
  );
}

/** Scrollable page body with standard padding (replaces `.page-body`). */
export function PageBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(pageBodyClassName, className)} {...props} />;
}

/** Horizontal gutter padding only (replaces `.page-gutter`). */
export function PageGutter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(pageGutterClassName, className)} {...props} />;
}

/** Gradient header strip used on queue / PO / operational pages. */
export function PageShellHeader({
  title,
  hideTitle,
  meta,
  actions,
  children,
  className,
}: HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  hideTitle?: boolean;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={cn(pageShellHeaderClassName, className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {!hideTitle && title ? (
            <h1 className="m-0 text-base font-bold text-text">{title}</h1>
          ) : null}
          {meta ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-2">
              {meta}
            </div>
          ) : null}
          {children}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Toolbar row under the page header (filters, search). */
export function PageToolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(pageToolbarClassName, className)} {...props} />;
}

/** Standard empty queue / table state. */
export function EmptyState({
  line,
  hint,
  className,
  children,
}: HTMLAttributes<HTMLDivElement> & {
  line: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className={cn(emptyStateClassName, className)}>
      <p className="m-0 text-[13px] text-text-3">{line}</p>
      {hint ? (
        <p className="mt-2 text-[11px] text-text-3">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

/** Hint line under operational queue tables. */
export function QueueTableHint({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn(queueTableHintClassName, className)} {...props}>
      {children}
    </p>
  );
}

/** Dashboard / reporting pages — scrollable body with vertical rhythm. */
export function ReportPageBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <PageBody className={cn("flex flex-col gap-4", className)} {...props} />
  );
}
