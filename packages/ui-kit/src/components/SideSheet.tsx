"use client";

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { cn } from "../lib/cn";
import { ModalClose } from "./Modal";
import { useSheetDialog } from "./use-sheet-dialog";

export type SideSheetProps = {
  open: boolean;
  title: string;
  /**
   * Scrollable body — one column of `FormGroup` fields, a date range in a
   * `FormRow`, statuses as checkboxes (docs/new-look decision). `SideSheet`
   * only provides the panel chrome, not the fields themselves.
   */
  children: ReactNode;
  /**
   * Fixed `bg-surface-2` footer — compose it from `Button`s: `variant="primary"`
   * «تطبيق (N)» first, `variant="default"` «إلغاء» next, and `variant="ghost"`
   * «مسح الكل» pushed to the far end with `className="ms-auto"`.
   */
  footer?: ReactNode;
  /** Fires on Escape, overlay click, and the × button — never treat this as "apply". */
  onClose: () => void;
  className?: string;
};

/**
 * Advanced-filter panel — 380px, slides in from the inline-start edge
 * (right, since this app is RTL-only) over a `bg-ink/45` scrim, 280ms
 * `ease-out-quart`. `role="dialog" aria-modal`, focus-trapped, Escape and
 * the overlay both close without applying, focus returns to the «تصفية»
 * trigger on close. Rule: the «تصفية» button always opens this, never a
 * popover; use `AppModal` instead for a decision that must precede
 * continuing (e.g. a destructive confirm).
 */
export function SideSheet({
  open,
  title,
  children,
  footer,
  onClose,
  className,
}: SideSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useSheetDialog(open, onClose, panelRef);

  if (!open) return null;

  return (
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
        className={cn(
          "fixed inset-y-0 start-0 flex w-[380px] max-w-full flex-col bg-surface shadow-modal outline-none ui-animate-sidesheet-in",
          className,
        )}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3.5">
          <h2 id={titleId} className="m-0 flex-1 text-[15px] font-semibold text-text">
            {title}
          </h2>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
