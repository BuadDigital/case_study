"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import type { CaseStudyReportModel } from "../../lib/app-data/case-study-report-model";
import { buildCaseStudyReportPrintHtml } from "../../lib/app-data/case-study-report-html";

export type CaseStudyReportFrameHandle = {
  /** Prints the report page itself, after its sheets have been laid out. */
  print: () => Promise<void>;
};

type Props = {
  model: CaseStudyReportModel;
  referenceNumber?: string | null;
  onLoad?: () => void;
};

const READY_POLL_MS = 50;
const READY_TIMEOUT_MS = 3000;

/**
 * The report preview is the exact page «تحميل التقرير» opens — letterhead sheets included — shown
 * in a frame, so what is previewed, printed and downloaded cannot drift apart.
 */
export const CaseStudyReportFrame = forwardRef<CaseStudyReportFrameHandle, Props>(
  function CaseStudyReportFrame({ model, referenceNumber, onLoad }, handle) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const html = useMemo(
      () =>
        buildCaseStudyReportPrintHtml(model, {
          origin: typeof window === "undefined" ? undefined : window.location.origin,
          referenceNumber,
          embedded: true,
        }),
      [model, referenceNumber],
    );

    const print = useCallback(async () => {
      const frame = frameRef.current;
      const doc = frame?.contentDocument;
      if (!frame?.contentWindow || !doc) return;
      const started = Date.now();
      while (
        doc.documentElement.getAttribute("data-csrd-ready") !== "1" &&
        Date.now() - started < READY_TIMEOUT_MS
      ) {
        await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
      }
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, []);

    useImperativeHandle(handle, () => ({ print }), [print]);

    return (
      <iframe
        ref={frameRef}
        title="معاينة تقرير دراسة الحالة"
        srcDoc={html}
        onLoad={onLoad}
        className="block h-[calc(100vh-150px)] w-full border-0 bg-[#e9ecf1]"
      />
    );
  },
);
