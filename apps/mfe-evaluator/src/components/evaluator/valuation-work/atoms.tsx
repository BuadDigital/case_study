"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/ui-kit";

/* ─── Tailwind class tokens (identity via @theme CSS vars) ─── */
export const vwInputClassName =
  "w-full rounded-[var(--radius)] border border-border-md bg-surface-2 px-3 py-2.5 text-[13px] font-semibold text-text outline-none";
export const vwThClassName =
  "whitespace-nowrap border-b-2 border-gold bg-surface-2 px-4 py-3.5 text-center text-[12px] font-bold text-heading";
export const vwTdClassName =
  "border-b border-border px-4 py-3 text-center text-[12.5px] text-text";

/* ─── shared UI atoms ─── */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardPad({ children }: { children: ReactNode }) {
  return <div className="px-[22px] pb-[22px] pt-[18px]">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 text-[14.5px] font-extrabold text-heading">
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11.5px] font-medium text-text-2">{children}</span>
  );
}

/** Value-ledger row (invoiceRows) — label/note on the right, value on the left. */
export function LedgerRow({
  label,
  note,
  value,
  valueClassName,
  strong,
}: {
  label: string;
  note?: string;
  value: string;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 border-b border-border px-4 py-[11px]",
        strong ? "bg-surface-2" : "bg-surface",
      )}
    >
      <div>
        <div
          className={cn(
            "text-[12.5px] text-heading",
            strong ? "font-extrabold" : "font-bold",
          )}
        >
          {label}
        </div>
        {note ? (
          <div className="mt-0.5 text-[10.5px] text-text-3">{note}</div>
        ) : null}
      </div>
      <span
        dir="ltr"
        className={cn(
          "font-extrabold text-heading",
          strong ? "text-[15px]" : "text-[13.5px]",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function BankTh({
  children,
  start,
  highlight,
}: {
  children: ReactNode;
  start?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3.5 text-[12px] font-bold text-heading",
        start ? "justify-start text-start" : "justify-center text-center",
        highlight && "bg-gold-soft",
      )}
    >
      {children}
    </div>
  );
}

export function BankTd({
  children,
  start,
  highlight,
  className,
}: {
  children?: ReactNode;
  start?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden px-4 py-3.5",
        start ? "justify-start text-start" : "justify-center text-center",
        highlight && "bg-gold-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToggleChip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius)] border px-[15px] py-[9px] text-[12px] font-bold transition-[background,color,border-color] duration-150",
        active
          ? "border-gold bg-gold-soft text-gold-d"
          : "border-border-md bg-surface text-text-2",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-[7px] rounded-[var(--radius)] border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-card transition-colors duration-150",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-[7px] rounded-[var(--radius)] border border-border-md bg-surface px-[13px] text-[12.5px] font-medium text-text-2",
      disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      {children}
    </button>
  );
}
