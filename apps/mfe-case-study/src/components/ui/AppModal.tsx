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
import {
  opsModalClose,
  opsModalFooter,
} from "../../lib/prototype/ops-tasks-tw";

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
  /** Ops create-task look: start title, gray X, surface-2 footer */
  look,
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
  look?: "ops-html";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const maxPx = maxWidthPx ?? (wide ? 720 : 420);
  const opsHtml = look === "ops-html";

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

  /*
    Wrapper must own width: overlay is flex; without w-full the card
    shrink-wraps to content and ignores ModalCard max-width.
  */
  const panel = (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={
        opsHtml
          ? "w-full outline-none [animation:opsModalIn_0.22s_ease_both]"
          : "w-full outline-none"
      }
      style={{ maxWidth: maxPx }}
      onClick={(e) => e.stopPropagation()}
    >
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-w-none"
      >
        <ModalHeader
          className={
            subtitle || opsHtml ? "items-start px-[22px] py-4" : undefined
          }
        >
          <div className="min-w-0 flex-1">
            <ModalTitle
              id={titleId}
              className="text-start text-[16px] font-extrabold"
            >
              {title}
            </ModalTitle>
            {subtitle ? (
              <p className="m-0 mt-1 text-[11.5px] font-normal text-text-3">
                {subtitle}
              </p>
            ) : null}
          </div>
          {opsHtml ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className={opsModalClose}
            >
              ×
            </button>
          ) : (
            <ModalClose onClick={onClose} aria-label="إغلاق">
              ×
            </ModalClose>
          )}
        </ModalHeader>
        <ModalBody
          className={
            wide || maxWidthPx || opsHtml ? "px-[22px] py-5" : undefined
          }
        >
          {children}
        </ModalBody>
        {footer ? (
          opsHtml ? (
            <footer className={opsModalFooter}>{footer}</footer>
          ) : (
            <ModalFooter>{footer}</ModalFooter>
          )
        ) : null}
      </ModalCard>
    </div>
  );

  /* ops-html (إنشاء مهمة): HTML-matching overlay — blur + top-aligned appear */
  if (opsHtml) {
    return (
      <>
        <style>{`@keyframes opsModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
        <div
          onClick={onClose}
          role="presentation"
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px]"
        >
          {panel}
        </div>
      </>
    );
  }

  return (
    <ModalOverlay
      onClick={onClose}
      role="presentation"
      className="overflow-hidden"
    >
      {panel}
    </ModalOverlay>
  );
}
