"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsLetterCard,
  useWorkDensity,
} from "@platform/ui-kit";

/* ─── shared UI atoms ─── */

/** Whether the card around a `CardPad` has a frame (so the pad has to keep its padding). */
const CardFrameContext = createContext(true);

/**
 * A block of a valuation screen.
 *
 * How it works: on the appraiser's page (the sections frame, `work` density — Omar 2026-11-10) the
 * section is already the panel, so a block is flat — no frame of its own, a thin rule above every
 * block but the first — instead of a card inside a card. The last block has no bottom margin: the
 * section's own bottom padding is the gap under it (the margin on top of it left a wide empty band
 * under «حفظ الأساليب» and under the last block of the market and final sections). `framed` keeps the frame for a block that
 * holds a table or a two-pane figure: those read as their own object. Anywhere else (the
 * standalone screens) every block is a framed card, as before.
 * Edge cases: `className` is added in both looks, so spacing and `!overflow-*` overrides still apply.
 */
export function Card({
  children,
  className,
  id,
  framed = false,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Keep the card frame inside the sections frame — for a table or a two-pane figure. */
  framed?: boolean;
}) {
  const work = useWorkDensity();
  if (work && !framed) {
    return (
      <CardFrameContext.Provider value={false}>
        <div
          id={id}
          className={cn(
            "mb-5 min-w-0 last:mb-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border [&:not(:first-child)]:pt-4",
            className,
          )}
        >
          {children}
        </div>
      </CardFrameContext.Provider>
    );
  }
  return (
    <CardFrameContext.Provider value>
      <div
        id={id}
        className={cn(opsLetterCard, "mb-5", className)}
      >
        {children}
      </div>
    </CardFrameContext.Provider>
  );
}

/** A block's padding: none inside a flat block (the section pads it), the card's own in a framed one. */
export function CardPad({ children }: { children: ReactNode }) {
  const framed = useContext(CardFrameContext);
  return <div className={framed ? "px-[22px] pb-[22px] pt-[18px]" : undefined}>{children}</div>;
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
