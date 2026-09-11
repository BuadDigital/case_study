/**
 * A printable A4 test page for the brand identity: the letterhead cut into the same four
 * slices the valuation report uses, the approval table (section 27) with the signature and
 * stamp at their centimetre sizes, and a 5 cm ruler to verify the print scale.
 */

import { escapeHtml } from "@platform/app-shared/lib/html-escape";
import { A4_HEIGHT_MM, type BrandAssetView } from "./brand-identity-state";

export function a4PageLayout(view: BrandAssetView) {
  return {
    headMm: view.head,
    footMm: Math.max(0, A4_HEIGHT_MM - view.footTop),
    startMm: view.padStart,
    endMm: view.pad,
  };
}

export function brandTestPageHtml(view: BrandAssetView): string {
  const { headMm, footMm, startMm, endMm } = a4PageLayout(view);
  const letterhead = escapeHtml(view.letterhead);
  const stamp = escapeHtml(view.stamp);
  const signature = escapeHtml(view.signature);

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>صفحة اختبار الهوية البصرية</title>
<style>
@page{size:A4;margin:0}
html,body{margin:0;background:#e9e6df}
.page{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff;overflow:hidden;font-family:system-ui,"Segoe UI",Tahoma,sans-serif;color:#102b4e}
.slice{position:absolute;background-image:url("${letterhead}");background-size:210mm 297mm;background-repeat:no-repeat}
.head{top:0;left:0;right:0;height:${headMm}mm;background-position:top center}
.foot{bottom:0;left:0;right:0;height:${footMm}mm;background-position:bottom center}
.start{top:${headMm}mm;bottom:${footMm}mm;right:0;width:${startMm}mm;background-position:top right}
.end{top:${headMm}mm;bottom:${footMm}mm;left:0;width:${endMm}mm;background-position:top left}
.content{position:absolute;top:${headMm}mm;bottom:${footMm}mm;right:${startMm}mm;left:${endMm}mm;padding:6mm;box-sizing:border-box;outline:.3mm dashed #a4906f}
h1{font-size:13pt;margin:0 0 4mm}
table{width:100%;border-collapse:collapse;font-size:10pt}
td{border:.3mm solid #ddd8cc;padding:2mm 3mm;vertical-align:middle}
td.k{width:38%;background:#faf8f3;font-weight:700}
td.v{text-align:center}
.sig{height:${view.sigH}cm;width:auto;display:inline-block}
.stamp{width:${view.stampW}cm;height:${view.stampH}cm;object-fit:contain;display:inline-block}
.check{margin-top:6mm;font-size:8.5pt;color:#6b7280;line-height:1.9}
.bar{display:inline-block;width:5cm;height:2mm;background:#102b4e;vertical-align:middle}
@media print{html,body{background:#fff}}
</style></head>
<body><section class="page">
<div class="slice head"></div><div class="slice foot"></div><div class="slice start"></div><div class="slice end"></div>
<div class="content">
<h1>27 — إعتماد التقرير</h1>
<table>
<tr><td class="k">المقيّم المعتمد</td><td class="v">—</td></tr>
<tr><td class="k">التوقيع</td><td class="v"><img class="sig" src="${signature}" alt="التوقيع"></td></tr>
<tr><td class="k">ختم المنشأة</td><td class="v"><img class="stamp" src="${stamp}" alt="ختم المنشأة"></td></tr>
</table>
<div class="check">
مسطرة التحقق: <span class="bar"></span> = 5 سم — اطبع بمقياس 100٪ وقِس الشريط.<br>
الهوامش: أعلى ${view.head} مم · الأسفل يبدأ من ${view.footTop} مم · يمين ${view.padStart} مم · يسار ${view.pad} مم<br>
الختم ${view.stampW}×${view.stampH} سم · التوقيع بارتفاع ${view.sigH} سم
</div>
</div>
</section></body></html>`;
}
