"use client";

import type { ReactNode } from "react";
import {
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsLetterCard,
} from "@platform/ui-kit";

/* ─── shared UI atoms ─── */
export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(opsLetterCard, "mb-5", className)}
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
        opsBtnPrimary,
        "shadow-card",
        disabled ? "cursor-not-allowed opacity-55" : null,
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
        opsBtnGhost,
        disabled ? "cursor-not-allowed opacity-55" : null,
      )}
    >
      {children}
    </button>
  );
}
