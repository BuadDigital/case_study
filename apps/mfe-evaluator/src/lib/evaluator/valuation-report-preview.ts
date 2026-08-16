import type { ValuationReportDocumentDto } from "@platform/api-client";
import { openApprovedValuationReportPreview } from "./valuation-report-approved-render";

/** Opens approved letterhead preview; falls back to a minimal outline if template fetch fails. */
export async function openValuationReportPreview(
  doc: ValuationReportDocumentDto,
): Promise<void> {
  try {
    await openApprovedValuationReportPreview(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر فتح القالب المعتمد";
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
    if (!w) throw err;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>معاينة</title></head>
<body style="font-family:Tahoma,sans-serif;padding:24px">
  <h1>تعذّر تحميل الكليشة المعتمدة</h1>
  <p>${message}</p>
  <p>طلب ${doc.displayId} · أقسام: ${doc.sections.length}</p>
  <p>تأكد أن الملف منشور على: ${doc.approvedTemplateUrl ?? "/ejadah/report-template-approved.html"}</p>
</body></html>`);
    w.document.close();
  }
}
