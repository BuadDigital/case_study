"use client";

import { useCallback, useRef, useState } from "react";
import { Button, useToast } from "@platform/ui-kit";
import { useEscapeKey } from "@platform/app-shared/hooks/use-escape-key";
import {
  CaseStudyReportFrame,
  type CaseStudyReportFrameHandle,
} from "./CaseStudyReportFrame";
import { CaseStudyReportPreviewModal } from "./CaseStudyReportPreviewModal";
import { buildCaseStudyReportPrintHtml } from "../../lib/app-data/case-study-report-html";
import { openHtmlDocumentInNewTab } from "../../lib/open-html-document";
import type { CaseStudyReportModel } from "../../lib/app-data/case-study-report-document-model";

type Props = {
  model: CaseStudyReportModel;
};

export function CaseStudyReportActions({ model }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { showToast } = useToast();

  useEscapeKey(previewOpen, () => setPreviewOpen(false));

  const frameRef = useRef<CaseStudyReportFrameHandle>(null);
  const printFromPreview = useCallback(() => {
    void frameRef.current?.print();
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
        <CaseStudyReportPreviewModal
          onClose={() => setPreviewOpen(false)}
          onPrint={printFromPreview}
        >
          <CaseStudyReportFrame ref={frameRef} model={model} />
        </CaseStudyReportPreviewModal>
      ) : null}
    </>
  );
}
