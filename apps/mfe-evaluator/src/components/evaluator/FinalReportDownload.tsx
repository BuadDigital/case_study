"use client";

import { useState } from "react";
import { Button, useToast } from "@platform/ui-kit";
import {
  downloadFinalReport,
  generateFinalReport,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { useSetReportDraft } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

/**
 * The generated final report (the approved report with the deposit code in its headers + the certificate page).
 * Shown once the final copy is issued: download when ready, retry when the file is still being prepared.
 */
export function FinalReportDownload({
  propertyId,
  draft,
}: {
  propertyId: string;
  draft: ValuationReportDraftDto;
}) {
  const { showToast } = useToast();
  const setDraft = useSetReportDraft(propertyId);
  const [busy, setBusy] = useState(false);

  if (draft.reportStage !== "final_issued") return null;
  const ready = draft.finalReportStatus === "ready";

  async function download() {
    const config = apiConfig();
    if (!config || busy) return;
    setBusy(true);
    try {
      const res = await downloadFinalReport(config, draft.valuationRequestId);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر تنزيل التقرير النهائي", "error");
        return;
      }
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `final-report-v${draft.version}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    const config = apiConfig();
    if (!config || busy) return;
    setBusy(true);
    try {
      const res = await generateFinalReport(config, draft.valuationRequestId);
      if (!res.ok) {
        showToast("تعذّر تجهيز ملف التقرير النهائي — أعد المحاولة بعد قليل", "error");
        return;
      }
      setDraft({ ...draft, finalReportStatus: res.data.finalReportStatus });
      showToast(
        res.data.finalReportStatus === "ready"
          ? "جهز ملف التقرير النهائي"
          : "ملف التقرير النهائي ما زال قيد الإعداد",
        res.data.finalReportStatus === "ready" ? "success" : "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="final-report-download">
      <span className="text-[12px] text-text-2">
        {ready ? "ملف التقرير النهائي (التقرير + رمز الإيداع + شهادة الإيداع) جاهز." : "ملف التقرير النهائي قيد الإعداد."}
      </span>
      {ready ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void download()}>
          تنزيل التقرير النهائي (PDF)
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void retry()}>
          {busy ? "جاري التجهيز…" : "إعادة تجهيز الملف"}
        </Button>
      )}
    </div>
  );
}
