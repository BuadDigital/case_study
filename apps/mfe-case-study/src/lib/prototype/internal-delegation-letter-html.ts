import type { InternalDelegationLetter } from "./internal-delegation-letters";
import { openHtmlDocumentInNewTab } from "../open-html-document";
import {
  formatDateAr,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "./po-intake-data";

export function printInternalDelegationLetter(
  letter: InternalDelegationLetter,
  record: PoIntakeRecord,
): void {
  const properties = record.properties.filter((p) =>
    letter.selectedPropertyIds.includes(p.id),
  );
  const rows = properties
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${formatPropertyDeedDisplay(p) || "—"}</td>
        <td>${p.ownerName || "—"}</td>
        <td>${p.taskNumber || "—"}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>خطاب تفويض الشركة — ${formatPoDisplay(letter.poNumber)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    .meta { margin-bottom: 16px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>خطاب تفويض الشركة — زيارة المحكمة</h1>
  <div class="meta">
    <div><strong>أمر العمل:</strong> ${formatPoDisplay(letter.poNumber)}</div>
    <div><strong>المدينة:</strong> ${letter.city || "—"}</div>
    <div><strong>المحكمة:</strong> ${letter.court}</div>
    <div><strong>الدائرة:</strong> ${letter.circuit}</div>
    <div><strong>التاريخ:</strong> <span dir="ltr">${formatDateAr(new Date().toISOString().slice(0, 10))}</span></div>
  </div>
  <p>يُفوَّض المراجع الحكومي بزيارة المحكمة المذكورة أعلاه لاستكمال إجراءات المراجعة وجمع المفاتيح للعقارات التالية:</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>رقم الصك / التسجيل</th>
        <th>المالك</th>
        <th>رقم المهمة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  openHtmlDocumentInNewTab(html, { print: true });
}
