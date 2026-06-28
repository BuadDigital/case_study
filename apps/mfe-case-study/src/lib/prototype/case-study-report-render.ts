import {
  CASE_STUDY_REPORT_SUBTITLE,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_REMARKS_HINT,
  CASE_STUDY_SIGNATURE_IMAGE,
  CASE_STUDY_STAMP_IMAGE,
} from "./case-study-form-data";
import type { CaseStudyQuestionSection } from "./case-study-form-data";
import type {
  CaseStudyReportModel,
  CaseStudyReportSection,
} from "./case-study-report-model";

export type CaseStudyReportRenderOptions = {
  origin?: string;
};

const SECTIONS_WITH_ALERT: ReadonlySet<CaseStudyQuestionSection> = new Set([
  "deed",
  "survey",
]);

const EXTRA_SUB_NOTE_DEFAULT =
  "في حال وجود اختلاف يتم التوضيح في الملاحظات ادناه / لا يوجد";

export function caseStudyReportAssetUrl(
  path: string,
  origin?: string,
): string {
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function escapeCaseStudyReportHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCb(checked: boolean): string {
  return `<span class="csrd-cb${checked ? " csrd-cb--on" : ""}" aria-hidden="true">${checked ? "☑" : "☐"}</span>`;
}

const WATERMARK_REPEAT_COUNT = 22;

function renderWatermarkHtml(): string {
  const words = Array.from({ length: WATERMARK_REPEAT_COUNT })
    .map(() => '<span class="csrd-watermark-word">EJADAH</span>')
    .join("");
  return `<div class="csrd-watermark" aria-hidden="true">
  <div class="csrd-watermark-repeat">${words}</div>
</div>`;
}

function renderPageChrome(): string {
  return `
<div class="csrd-header" aria-hidden="true">
  <div class="csrd-header-placeholder">
    <div class="csrd-header-logo">
      <div class="csrd-header-wordmark">EJADAH<span class="csrd-header-wordmark-dot">.</span></div>
      <div class="csrd-header-sub">PROFESSIONAL</div>
    </div>
    <div class="csrd-header-divider"></div>
    <div class="csrd-header-service">
      <div class="csrd-header-service-en">VALUATION<br/>SERVICES</div>
    </div>
  </div>
</div>
<div class="csrd-footer" aria-hidden="true">
  <div class="csrd-footer-placeholder">
    <div class="csrd-footer-col">
      <div>📍 Jeddah 23326 – Building No. 9360 add No. 4150</div>
      <div>📞 920011838</div>
      <div>✉ info@ejadah-sa.com</div>
    </div>
    <div class="csrd-footer-sep"></div>
    <div class="csrd-footer-col">
      <div>C.R. 4030297680</div>
      <div>VAT: 310163856300003</div>
      <div>CL: 11000007</div>
      <div class="csrd-footer-gold">Ejadah-sa.com</div>
    </div>
    <div class="csrd-footer-ar">شركة إجادة المهنية<br/>Ejadah Professional Company</div>
  </div>
</div>
${renderWatermarkHtml()}`;
}

function renderCommissionTable(model: CaseStudyReportModel): string {
  const esc = escapeCaseStudyReportHtml;
  const rows = [
    `<tr><td class="csrd-data-lbl">اسم مزود الخدمة</td><td>${esc(model.providerName)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">رقم الطلب</td><td class="csrd-ltr">${esc(model.requestNumber)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">تاريخ الطلب</td><td class="csrd-ltr">${esc(model.requestDate)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">رقم الصك</td><td class="csrd-ltr">${esc(model.deedNumber)}</td></tr>`,
  ];
  if (model.propertyLocation) {
    rows.push(
      `<tr><td class="csrd-data-lbl">الموقع</td><td>${esc(model.propertyLocation)}</td></tr>`,
    );
  }
  if (model.propertyType) {
    rows.push(
      `<tr><td class="csrd-data-lbl">نوع العقار</td><td>${esc(model.propertyType)}</td></tr>`,
    );
  }
  if (model.assignmentSpecialist && model.assignmentSpecialist !== "—") {
    rows.push(
      `<tr><td class="csrd-data-lbl">أخصائي الإسناد</td><td>${esc(model.assignmentSpecialist)}</td></tr>`,
    );
  }
  return `<div class="csrd-section"><table class="csrd-table"><tbody>
    <tr class="csrd-sec-hdr"><td colspan="2">بيانات التعميد</td></tr>
    ${rows.join("")}
  </tbody></table></div>`;
}

function renderSection(section: CaseStudyReportSection): string {
  const esc = escapeCaseStudyReportHtml;
  const pageBreak = section.id === "comp" ? " csrd-section--break" : "";
  const alert = SECTIONS_WITH_ALERT.has(section.id)
    ? `<div class="csrd-alert">⚠ ${esc(CASE_STUDY_SECTION_REMARKS_HINT)}</div>`
    : "";
  const notesLabel =
    section.id === "deed" || section.id === "survey"
      ? CASE_STUDY_SECTION_REMARKS_HINT
      : "الملاحظات";
  const occExtra = section.id === "occ" ? section.extras?.[0] : undefined;
  const compExtras = section.id === "comp" ? (section.extras ?? []) : [];

  const bodyRows = section.rows
    .map((row, i) => {
      const occSuffix =
        section.id === "occ" &&
        i === section.rows.length - 1 &&
        occExtra
          ? `<span class="csrd-muted"> — ${esc(occExtra)}</span>`
          : "";
      const main = `<tr>
        <td>${esc(row.question)}${occSuffix}</td>
        <td class="csrd-yn">${renderCb(row.markA)}</td>
        <td class="csrd-yn">${renderCb(row.markB)}</td>
      </tr>`;
      const sub =
        section.id === "extra"
          ? `<tr class="csrd-sub-row"><td colspan="3">${esc(EXTRA_SUB_NOTE_DEFAULT)}</td></tr>`
          : "";
      return main + sub;
    })
    .join("");

  const extras = compExtras
    .map((line) => `<tr><td colspan="3">${esc(line)}</td></tr>`)
    .join("");

  const notes =
    section.id !== "extra"
      ? `<tr class="csrd-notes-row"><td colspan="3">
          <span class="csrd-notes-label">${esc(notesLabel)}</span>
          ${section.remarks?.trim() ? esc(section.remarks) : "—"}
        </td></tr>`
      : "";

  return `<div class="csrd-section${pageBreak}">
    ${alert}
    <table class="csrd-table"><tbody>
      <tr class="csrd-sec-hdr"><td colspan="3">${esc(section.title)}</td></tr>
      <tr class="csrd-col-hdr">
        <th>الأسئلة</th>
        <th class="csrd-yn">${esc(section.colAHeader)}</th>
        <th class="csrd-yn">${esc(section.colBHeader)}</th>
      </tr>
      ${bodyRows}${extras}${notes}
    </tbody></table>
  </div>`;
}

function renderApproval(
  model: CaseStudyReportModel,
  signatureSrc: string,
  stampSrc: string,
): string {
  const esc = escapeCaseStudyReportHtml;
  const { approval } = model;
  return `<div class="csrd-approval-block">
    <div class="csrd-approval-decl">${esc(approval.declarationText)}</div>
    <table class="csrd-table csrd-approval-table">
      <thead><tr>
        <th style="width:22%">رقم الصك:</th>
        <th style="width:22%">معتمد التقرير</th>
        <th style="width:16%">التاريخ</th>
        <th style="width:20%">التوقيع</th>
        <th style="width:20%">ختم الشركة</th>
      </tr></thead>
      <tbody><tr>
        <td class="csrd-ltr csrd-bold">${esc(approval.deedNumber)}</td>
        <td>${esc(approval.approverName)}</td>
        <td class="csrd-ltr">${esc(approval.reportDate)}</td>
        <td><img src="${esc(signatureSrc)}" alt="توقيع" /></td>
        <td><img src="${esc(stampSrc)}" alt="ختم" /></td>
      </tr></tbody>
    </table>
  </div>`;
}

export function caseStudyReportPrintCss(): string {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Arial, sans-serif;
  background: #fff;
  direction: rtl;
}
@page { size: A4 portrait; margin: 0; }
.csrd-root {
  --navy:#0f2a4e; --gold:#a38f67; --border:#c8c8c8; --row-alt:#f9fafc;
  --sub-bg:#f5f6f8; --approval-bg:#f8f9fa; --yellow-bg:#fffbeb; --yellow-bdr:#e5c84a;
  --yellow-text:#7a5f00; --text:#1c1c1c; --text-muted:#5a5a5a; --white:#fff;
  --header-h:38mm; --footer-h:24mm; --margin-top:42mm; --margin-btm:28mm;
  --margin-side:14mm; --wm-w:17mm;
  font-size:9.5pt; line-height:1.45; color:var(--text); direction:rtl;
  width:210mm; margin:0 auto; padding:var(--margin-top) var(--margin-side) var(--margin-btm);
  min-height:297mm; position:relative; background:#fff;
}
.csrd-header { position:absolute; top:0; right:0; left:0; height:var(--header-h); z-index:200; background:#fff; overflow:hidden; }
.csrd-header-placeholder { width:100%; height:100%; display:flex; border-bottom:3px solid var(--gold); }
.csrd-header-logo { background:var(--navy); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 14px; min-width:55mm; gap:3px; }
.csrd-header-wordmark { color:#fff; font-size:20pt; font-weight:700; line-height:1; }
.csrd-header-wordmark-dot { color:var(--gold); }
.csrd-header-sub { color:var(--gold); font-size:7.5pt; font-weight:600; letter-spacing:3px; }
.csrd-header-divider { width:4px; background:var(--gold); align-self:stretch; }
.csrd-header-service { display:flex; flex-direction:column; justify-content:center; padding:0 16px; }
.csrd-header-service-en { color:var(--gold); font-size:9.5pt; font-weight:600; letter-spacing:2.5px; line-height:1.4; }
.csrd-footer { position:absolute; bottom:0; right:0; left:0; height:var(--footer-h); z-index:200; background:#fff; overflow:hidden; }
.csrd-footer-placeholder { width:100%; height:100%; display:flex; align-items:center; padding:0 14mm; border-top:1.5px solid var(--border); direction:ltr; }
.csrd-footer-col { display:flex; flex-direction:column; gap:2px; font-size:7.5pt; color:var(--text-muted); }
.csrd-footer-sep { width:1px; height:22px; background:var(--border); margin:0 18px; }
.csrd-footer-gold { color:var(--gold); font-weight:600; }
.csrd-footer-ar { margin-left:auto; text-align:right; direction:rtl; font-size:8pt; font-weight:600; }
.csrd-watermark { position:absolute; top:var(--header-h); bottom:var(--footer-h); right:0; left:auto; width:var(--wm-w); z-index:0; pointer-events:none; overflow:hidden; }
.csrd-watermark-repeat { display:flex; flex-direction:column; align-items:center; justify-content:space-between; height:100%; width:100%; padding:3mm 0; }
.csrd-watermark-word { font-family:"Segoe UI",Arial,sans-serif; font-size:6.5pt; font-weight:900; letter-spacing:0.6px; line-height:1; color:transparent; -webkit-text-stroke:0.35px rgba(15,42,78,0.18); opacity:0.55; white-space:nowrap; }
.csrd-content { position:relative; z-index:1; }
.csrd-title-block { text-align:center; margin-bottom:5mm; padding-bottom:4mm; border-bottom:1.5px solid var(--gold); }
.csrd-title-main { font-size:14pt; font-weight:700; color:var(--navy); }
.csrd-title-sub { font-size:10pt; font-weight:600; color:var(--gold); margin-top:2px; }
.csrd-ltr { direction:ltr; text-align:right; }
.csrd-bold { font-weight:700; }
.csrd-muted { color:var(--text-muted); font-size:8.5pt; }
.csrd-table { width:100%; border-collapse:collapse; margin-bottom:4.5mm; font-size:9.5pt; table-layout:fixed; }
.csrd-table th, .csrd-table td { border:1px solid var(--border); padding:4px 8px; vertical-align:middle; text-align:right; }
.csrd-table .csrd-sec-hdr td { background:var(--navy); color:#fff; font-size:11pt; font-weight:700; text-align:center; border-color:var(--navy); }
.csrd-table .csrd-col-hdr th { background:var(--navy); color:#fff; font-size:9pt; font-weight:600; text-align:center; }
.csrd-table .csrd-col-hdr th:first-child { text-align:right; }
.csrd-yn { text-align:center !important; width:28mm; }
.csrd-data-lbl { font-weight:600; color:var(--navy); width:38%; background:var(--row-alt); }
.csrd-table .csrd-sub-row td { background:var(--sub-bg); font-size:8.5pt; color:var(--text-muted); font-style:italic; border-top:none; }
.csrd-table .csrd-notes-row td { background:var(--approval-bg); font-size:9pt; line-height:1.55; }
.csrd-notes-label { display:block; font-weight:700; color:var(--navy); margin-bottom:2px; }
.csrd-alert { background:var(--yellow-bg); border:1px solid var(--yellow-bdr); border-radius:3px; padding:4px 10px; font-size:9pt; color:var(--yellow-text); margin-bottom:1.5mm; }
.csrd-cb { font-size:14px; display:inline-block; width:18px; text-align:center; color:#444; }
.csrd-cb--on { color:var(--navy); font-size:15px; }
.csrd-approval-decl { background:var(--approval-bg); border-right:4px solid var(--gold); padding:7px 12px; font-size:9.5pt; margin-bottom:3mm; line-height:1.5; }
.csrd-approval-table th { background:var(--navy); color:#fff; font-size:9.5pt; font-weight:600; text-align:center; }
.csrd-approval-table td { height:26mm; text-align:center; vertical-align:middle; }
.csrd-approval-table img { max-height:22mm; max-width:100%; object-fit:contain; display:block; margin:0 auto; }
.csrd-section { page-break-inside:avoid; }
.csrd-section--break { page-break-before:always; }
.csrd-approval-block { page-break-inside:avoid; }
@media print {
  .csrd-root { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .csrd-header { position:fixed; top:0; right:0; left:0; width:210mm; margin:0 auto; height:var(--header-h); }
  .csrd-footer { position:fixed; bottom:0; right:0; left:0; width:210mm; margin:0 auto; height:var(--footer-h); }
  .csrd-watermark { position:fixed; top:var(--header-h); bottom:var(--footer-h); right:calc(50% - 105mm); left:auto; width:var(--wm-w); }
}
`;
}

export function buildCaseStudyReportBodyHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const origin = options?.origin;
  const signatureSrc = caseStudyReportAssetUrl(
    CASE_STUDY_SIGNATURE_IMAGE,
    origin,
  );
  const stampSrc = caseStudyReportAssetUrl(CASE_STUDY_STAMP_IMAGE, origin);
  const esc = escapeCaseStudyReportHtml;

  return `<div class="csrd-root" lang="ar" dir="rtl">
${renderPageChrome()}
<div class="csrd-content">
  <div class="csrd-title-block">
    <div class="csrd-title-main">${esc(CASE_STUDY_REPORT_TITLE)}</div>
    <div class="csrd-title-sub">${esc(CASE_STUDY_REPORT_SUBTITLE)}</div>
  </div>
  ${renderCommissionTable(model)}
  ${model.sections.map(renderSection).join("")}
  ${renderApproval(model, signatureSrc, stampSrc)}
</div>
</div>`;
}

export function buildCaseStudyReportPrintHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const esc = escapeCaseStudyReportHtml;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(CASE_STUDY_REPORT_TITLE)} — ${esc(model.deedNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${caseStudyReportPrintCss()}</style>
</head>
<body>
${buildCaseStudyReportBodyHtml(model, options)}
</body>
</html>`;
}
