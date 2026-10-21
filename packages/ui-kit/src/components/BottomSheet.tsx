"use client";

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { ModalClose } from "./Modal";
import { useSheetDialog } from "./use-sheet-dialog";

export type BottomSheetProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Pinned under the scrolling body — e.g. a primary action. */
  footer?: ReactNode;
  /** Fires on Escape, scrim tap and the × button. */
  onClose: () => void;
  className?: string;
};

/**
 * Phone panel that slides up from the bottom edge over a `bg-ink/45` scrim —
 * the phone counterpart of `SideSheet` / a desktop popover. Grab handle, title,
 * scrolling body (max 85% of the screen), safe-area padding for the home
 * indicator. `role="dialog" aria-modal`, focus-trapped, Escape and scrim close.
 * Portalled to `<body>` so a transformed ancestor never clips it.
 */
export function BottomSheet({
  open,
  title,
  children,
  footer,
  onClose,
  className,
}: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useSheetDialog(open, onClose, panelRef);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-[var(--z-modal)] bg-ink/45 ui-animate-fade-in"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        className={cn(
          "fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[18px] bg-surface shadow-modal outline-none ui-animate-bottomsheet-in",
          "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-border-md" />
        </div>
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 pb-3 pt-1">
          <h2 id={titleId} className="m-0 flex-1 text-[15px] font-bold text-heading">
            {title}
          </h2>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
