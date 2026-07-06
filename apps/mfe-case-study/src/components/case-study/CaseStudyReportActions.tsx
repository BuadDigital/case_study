"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ModalBody, ModalHeader, ModalOverlay, ModalTitle, useToast } from "@platform/design-system";
import { CaseStudyReportDocument } from "./CaseStudyReportDocument";
import { buildCaseStudyReportPrintHtml } from "../../lib/prototype/case-study-report-html";
import { openHtmlDocumentInNewTab } from "../../lib/open-html-document";
import type { CaseStudyReportModel } from "../../lib/prototype/case-study-report-model";

type Props = {
  model: CaseStudyReportModel;
};

export function CaseStudyReportActions({ model }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  const printFromPreview = useCallback(() => {
    window.print();
  }, []);

  const openPrintWindow = useCallback(() => {
    const html = buildCaseStudyReportPrintHtml(model, {
      origin: window.location.origin,
    });
    const opened = openHtmlDocumentInNewTab(html);
    if (!opened) {
      showToast("تعذّر فتح نافذة التقرير — تحقق من إعدادات المنبثقات.", "error");
    }
  }, [model, showToast]);

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          معاينة التقرير
        </Button>
        <Button variant="primary" onClick={openPrintWindow}>
          تحميل التقرير
        </Button>
      </div>

      {previewOpen ? (
        <ModalOverlay
          className="z-[1200] items-start overflow-y-auto p-6 px-4 print:absolute print:inset-0 print:overflow-visible print:bg-white print:p-0"
          onClick={() => setPreviewOpen(false)}
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
                <Button size="sm" variant="primary" onClick={printFromPreview}>
                  طباعة / PDF
                </Button>
                <Button size="sm" onClick={() => setPreviewOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </ModalHeader>
            <ModalBody className="max-h-[calc(100vh-120px)] overflow-auto p-0 print:max-h-none print:overflow-visible print:bg-white">
              <div className="cs-report-preview-shell print:p-0">
                <CaseStudyReportDocument model={model} id="cs-report-print-root" />
              </div>
            </ModalBody>
          </div>
        </ModalOverlay>
      ) : null}
    </>
  );
}
