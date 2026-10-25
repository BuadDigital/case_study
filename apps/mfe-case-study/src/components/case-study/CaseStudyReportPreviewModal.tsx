"use client";

import type { ReactNode } from "react";
import { Button, ModalBody, ModalHeader, ModalOverlay, ModalTitle } from "@platform/ui-kit";

/** A4 «معاينة التقرير النهائي» lightbox around the report frame (`children`), with print + close. */
export function CaseStudyReportPreviewModal({
  onClose,
  onPrint,
  children,
}: {
  onClose: () => void;
  onPrint: () => void;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      className="z-[var(--z-lightbox)] items-start overflow-y-auto p-6 px-4 print:absolute print:inset-0 print:overflow-visible print:bg-white print:p-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="معاينة تقرير دراسة الحالة"
    >
      <div
        className="w-[210mm] max-w-full overflow-hidden rounded-xl bg-surface-2 shadow-lg print:rounded-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader className="print:hidden border-b border-border bg-surface px-3.5 py-2.5">
          <ModalTitle className="text-start text-[13px]">
            معاينة التقرير النهائي
          </ModalTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={onPrint}>
              طباعة / PDF
            </Button>
            <Button size="sm" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </ModalHeader>
        <ModalBody className="p-0">{children}</ModalBody>
      </div>
    </ModalOverlay>
  );
}
