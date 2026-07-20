"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import {
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/design-system";

export function AppModal({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  wide,
  /** Explicit max width (e.g. 720 for HTML task create). Overrides wide default. */
  maxWidthPx,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  /** Wider card for two-column forms (PO intake, etc.). */
  wide?: boolean;
  maxWidthPx?: number;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const maxPx = maxWidthPx ?? (wide ? 720 : 420);

  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <ModalOverlay
      onClick={onClose}
      role="presentation"
      className="overflow-hidden"
    >
      {/*
        Wrapper must own width: ModalOverlay is flex; without w-full the card
        shrink-wraps to content and ignores ModalCard max-width.
      */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full outline-none"
        style={{ maxWidth: maxPx }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCard
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="max-w-none"
        >
          <ModalHeader className={subtitle ? "items-start px-[22px] py-4" : undefined}>
            <div className="min-w-0 flex-1">
              <ModalTitle id={titleId} className="text-start text-[16px] font-extrabold">
                {title}
              </ModalTitle>
              {subtitle ? (
                <p className="m-0 mt-1 text-[11.5px] font-normal text-text-3">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <ModalClose onClick={onClose} aria-label="إغلاق">
              ×
            </ModalClose>
          </ModalHeader>
          <ModalBody className={wide || maxWidthPx ? "px-[22px] py-5" : undefined}>
            {children}
          </ModalBody>
          {footer ? <ModalFooter>{footer}</ModalFooter> : null}
        </ModalCard>
      </div>
    </ModalOverlay>
  );
}
