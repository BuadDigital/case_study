import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { opsFieldBox } from "../lib/ops-chrome";

/** Underlined section heading inside a work panel (engineering survey, evaluator window). */
export function OpsSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 mt-[18px] border-b border-border pb-[7px] text-[13px] font-bold text-heading",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type OpsInfoNoteVariant = "gold" | "amber" | "red";

const INFO_NOTE_STYLES: Record<OpsInfoNoteVariant, string> = {
  gold: "border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] text-text-2",
  amber:
    "border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg text-amber-text",
  red: "border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-bg text-danger-text",
};

/** Bordered info line in a work panel; the caller sets the bottom margin. */
export function OpsInfoNote({
  children,
  variant = "gold",
  className,
}: {
  children: ReactNode;
  variant?: OpsInfoNoteVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-[11.5px] leading-[1.7]",
        INFO_NOTE_STYLES[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Read-only label/value box; `children` wins over `value`, and an empty field shows «—». */
export function OpsReadField({
  label,
  value,
  ltr,
  children,
}: {
  label: string;
  value?: ReactNode;
  ltr?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={opsFieldBox}>
      <div className="mb-[3px] text-[10.5px] text-text-3">{label}</div>
      <div
        className={cn(
          "text-[12.5px] font-semibold text-text",
          ltr && "text-end [direction:ltr]",
        )}
      >
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}
