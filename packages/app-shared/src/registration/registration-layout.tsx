"use client";

import type { HTMLAttributes, ReactNode } from "react";
import {
  Button,
  cn,
  FormRow,
  Input,
  Note,
  type NoteTone,
} from "@platform/design-system";
import type { RegistrationSource } from "../prototype/registration-data";

export const FLOW_THEME: Record<
  RegistrationSource,
  {
    cardBorder: string;
    flowText: string;
    sideLogo: string;
    sideDept: string;
    stepActive: string;
    stepLabelActive: string;
    pillSelected: string;
    orgHighlight: string;
    subHighlight: string;
  }
> = {
  hr: {
    cardBorder: "border-t-primary",
    flowText: "text-primary",
    sideLogo: "bg-primary",
    sideDept: "text-primary",
    stepActive: "border-primary bg-primary text-white",
    stepLabelActive: "font-bold text-primary",
    pillSelected:
      "border-primary bg-primary text-white shadow-[0_0_0_2px_rgb(29_158_117/0.2)]",
    orgHighlight: "font-bold text-primary",
    subHighlight: "font-semibold text-primary",
  },
  proc: {
    cardBorder: "border-t-blue",
    flowText: "text-blue",
    sideLogo: "bg-blue",
    sideDept: "text-blue",
    stepActive: "border-blue bg-blue text-white",
    stepLabelActive: "font-bold text-blue",
    pillSelected:
      "border-primary bg-primary text-white shadow-[0_0_0_2px_rgb(29_158_117/0.2)]",
    orgHighlight: "font-bold text-blue",
    subHighlight: "font-semibold text-blue",
  },
  crm: {
    cardBorder: "border-t-amber",
    flowText: "text-amber",
    sideLogo: "bg-amber",
    sideDept: "text-amber",
    stepActive: "border-amber bg-amber text-white",
    stepLabelActive: "font-bold text-amber-text",
    pillSelected:
      "border-amber bg-amber text-white shadow-[0_0_0_2px_rgb(239_159_39/0.2)]",
    orgHighlight: "font-bold text-amber-text",
    subHighlight: "font-semibold text-amber-text",
  },
};

export function RegInfoBox({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: NoteTone | "gold";
  className?: string;
}) {
  const mapped = tone === "gold" ? "warn" : tone;
  return (
    <Note tone={mapped} className={cn("my-2", className)}>
      {children}
    </Note>
  );
}

export function RegErrorAlert({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <Note tone="danger" className="mt-2">
      {error}
    </Note>
  );
}

export function RegSectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-3">
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function RegGrid2({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <FormRow className={cn("max-sm:grid-cols-1", className)} {...props} />
  );
}

export function RegGrid3({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}
      {...props}
    />
  );
}

export function RegSpan2({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("col-span-2 max-sm:col-span-1", className)} {...props} />
  );
}

export function RegInlineInput(
  props: React.ComponentProps<typeof Input>,
) {
  return <Input className="text-xs" {...props} />;
}

export function RegRemoveButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded p-1 text-text-3 transition-colors hover:bg-danger-bg hover:text-danger-text",
        className,
      )}
      aria-label={label}
      onClick={onClick}
    >
      ×
    </button>
  );
}

export function RegAddMemberButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-border-md bg-transparent px-3 py-1.5 text-xs font-semibold text-info-text transition-colors hover:bg-info-bg"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RegStepBadge({
  done,
  children,
}: {
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[10px] border px-2.5 py-0.5 text-[10.5px] font-semibold",
        done
          ? "border-transparent bg-success-bg text-success-text"
          : "border-border bg-surface-2 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export { Button, cn, FormRow, Note };
