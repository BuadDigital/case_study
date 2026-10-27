"use client";

import type { ReactNode } from "react";
import {
  EmptyIconBuilding,
  EmptyState,
  StatusPill,
  cn,
  opsPpHeadCard,
  type StatusPillStyle,
} from "@platform/ui-kit";
import { PropertyListRowStatuses } from "@platform/api-client";

/**
 * Case Study.html `renderProperties` primitives
 * (`_professional-ui-design - property-details2/Case Study.html`).
 */

const PP_FOOTER_HINT = "اضغط الصف لمعاينة تفاصيل العقار.";

/** HTML `typeTone` */
export function assignmentTypeTone(type: string): string {
  if (type === "تنفيذ") return "#2a6f9e";
  if (type === "تركات") return "#a67c1a";
  if (type === "قطاع خاص" || type === "خاص") return "#6b5b95";
  return "#8a8d96";
}

/** Workflow stage → HTML `.status` colors. */
export function propertyWorkflowStatusStyle(
  status: string,
): StatusPillStyle & { label: string } {
  switch (status) {
    case PropertyListRowStatuses.Done:
      return { label: "مكتمل", base: "#3f8f5f", fg: "#2f7a4d" };
    case PropertyListRowStatuses.Ready:
      return { label: "جاهز للرفع", base: "#d9a441", fg: "#b8791a" };
    case PropertyListRowStatuses.Fail:
    case "removed":
      return {
        label: status === "removed" ? "محذوف" : "تعذّر",
        base: "#d9694f",
        fg: "#c0553d",
      };
    case PropertyListRowStatuses.Progress:
    case "under_study":
    case "review":
    case PropertyListRowStatuses.Incomplete:
      return {
        label:
          status === "under_study"
            ? "قيد الدراسة"
            : status === "review"
              ? "قيد المراجعة"
              : status === PropertyListRowStatuses.Incomplete
                ? "ناقص"
                : "قيد العمل",
        base: "#a4906f",
        fg: "#8c7857",
      };
    case PropertyListRowStatuses.New:
    case "pending":
    default:
      return {
        label: status === "pending" ? "معلّق" : "جديد",
        base: "#2a6f9e",
        fg: "#1f5a82",
      };
  }
}

export function deedStatusStyle(deedStatus: string): StatusPillStyle {
  return deedStatus.trim() === "فعال"
    ? { base: "#3f8f5f", fg: "#2f7a4d" }
    : { base: "#8a8d96", fg: "#73767f" };
}

export function PpHead({ children }: { children: ReactNode }) {
  return (
    <div className={cn(opsPpHeadCard, "relative mb-[18px]")}>
      {children}
    </div>
  );
}

export function PpTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
      {children}
    </h1>
  );
}

export function PpPo({ children }: { children: ReactNode }) {
  return (
    <span className="text-[14px] font-bold text-[var(--gold-d,#8c7857)] [direction:ltr]">
      {children}
    </span>
  );
}

export function PpMeta({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-text-2">
      {children}
    </div>
  );
}

export function PpBadge({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[12px] font-bold"
      style={{
        background: `color-mix(in srgb, ${tone} 15%, transparent)`,
        color: tone,
      }}
    >
      {children}
    </span>
  );
}

export function PpSummary({
  children,
  "aria-label": ariaLabel = "ملخص أمر العمل",
}: {
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div
      // Phones: a 2×2 grid — the divided row wrapped its 4th cell onto a broken line.
      className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3.5 sm:flex sm:flex-wrap sm:gap-0"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function PpCell({
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
        "min-w-0 sm:px-[18px]",
        first
          ? "sm:ps-0 sm:pe-[18px]"
          : "sm:border-s sm:border-border",
      )}
    >
      <div className="mb-0.5 text-[11px] text-text-3">{label}</div>
      <div className="text-[13.5px] font-semibold text-heading">{children}</div>
    </div>
  );
}

export function PpDeedCell({
  index,
  deed,
  emphasize,
}: {
  index: number;
  deed: string;
  emphasize?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <span
        className="inline-grid size-5 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-[10px] font-bold tabular-nums text-text-3"
        aria-hidden
      >
        {index}
      </span>
      <span
        dir="ltr"
        className={cn(
          "truncate text-[13px] font-bold text-gold-d",
          emphasize &&
            "underline decoration-gold-d underline-offset-2",
        )}
      >
        {deed}
      </span>
    </span>
  );
}

export function PpStatus({
  label,
  style,
}: {
  label: string;
  style: StatusPillStyle;
}) {
  return <StatusPill label={label} style={style} />;
}

export function PpEmpty({
  title = "لا توجد عقارات في هذا الأمر.",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <EmptyState panel line={title} hint={subtitle}>
      <EmptyIconBuilding />
    </EmptyState>
  );
}

export function PpFooterHint({ children = PP_FOOTER_HINT }: { children?: ReactNode }) {
  return (
    <p className="m-0 px-1 pb-0 pt-3 text-[11.5px] text-text-3 max-sm:hidden">{children}</p>
  );
}
