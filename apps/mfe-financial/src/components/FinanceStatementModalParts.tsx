"use client";

/**
 * Header and error banner shared by the statement modals (vendor invoice match,
 * disbursement close) — same look, the title and busy flag come from the caller.
 */

import type { ReactNode } from "react";
import { ModalClose, ModalHeader, ModalTitle } from "@platform/ui-kit";

export function StatementModalHeader({
  titleId,
  closeDisabled,
  onClose,
  children,
}: {
  titleId: string;
  closeDisabled: boolean;
  onClose: () => void;
  /** The title text. */
  children: ReactNode;
}) {
  return (
    <ModalHeader className="justify-between gap-3 px-[22px] py-4">
      <div className="min-w-0 text-start">
        <ModalTitle id={titleId} className="text-start text-base font-extrabold text-heading">
          {children}
        </ModalTitle>
      </div>
      <ModalClose
        disabled={closeDisabled}
        onClick={onClose}
        aria-label="إغلاق"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] text-text-2 hover:bg-[#faf6ee] hover:text-heading"
      >
        ✕
      </ModalClose>
    </ModalHeader>
  );
}

/** The red alert at the top of the modal body; nothing when there is no error. */
export function StatementModalError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold leading-[1.7] text-[#a32d2d]"
      role="alert"
    >
      {message}
    </div>
  );
}
