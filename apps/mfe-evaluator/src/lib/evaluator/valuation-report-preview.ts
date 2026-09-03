import type { ValuationReportDocumentDto } from "@platform/api-client";
import { openApprovedValuationReportPreview } from "./valuation-report-approved-render";

/** Opens approved letterhead preview; falls back to a minimal outline if template fetch fails. */
export async function openValuationReportPreview(
  doc: ValuationReportDocumentDto,
  extras?: { reportNumber?: string | null; depositCode?: string | null },
): Promise<void> {
  try {
    await openApprovedValuationReportPreview(doc, extras);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر فتح القالب المعتمد";
    // "noopener" in features makes window.open return null — open with a handle then clear opener.
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) throw err;
    w.opener = null;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>استعراض تقرير التقييم</title></head>
<body style="font-family:Tahoma,sans-serif;padding:24px">
  <h1>تعذّر تحميل الكليشة المعتمدة</h1>
  <p>${message}</p>
  <p>طلب ${doc.displayId} · أقسام: ${doc.sections.length}</p>
  <p>تأكد أن الملف منشور على: ${doc.approvedTemplateUrl ?? "/ejadah/report-template-approved.html"}</p>
</body></html>`);
    w.document.close();
  }
}
