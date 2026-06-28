import {
  CASE_STUDY_LETTERHEAD_IMAGE,
  CASE_STUDY_REPORT_SUBTITLE,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_REMARKS_HINT,
  CASE_STUDY_SIGNATURE_IMAGE,
  CASE_STUDY_STAMP_IMAGE,
} from "./case-study-form-data";
import type { CaseStudyQuestionSection } from "./case-study-form-data";
import type { CaseStudyReportModel } from "./case-study-report-model";

export type CaseStudyReportRenderOptions = {
  origin?: string;
  /** Include letterhead background (screen preview + print). */
  letterhead?: boolean;
};

const SECTIONS_WITH_REMARKS_HINT: ReadonlySet<CaseStudyQuestionSection> =
  new Set(["deed", "survey"]);

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

export function renderCaseStudyReportMark(checked: boolean): string {
  return `<span class="cs-report-mark${checked ? " checked" : ""}" aria-hidden="true">${checked ? "✓" : ""}</span>`;
}

export function caseStudyReportPrintCss(letterheadUrl?: string): string {
  const letterheadBefore = letterheadUrl
    ? `
.cs-report-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: url("${letterheadUrl}");
  background-size: 210mm 297mm;
  background-repeat: repeat-y;
  background-position: top center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}`
    : "";

  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  font-size: 10.5px;
  color: #1a2b3c;
  background: #fff;
  direction: rtl;
  padding: 0;
}
${letterheadBefore}
.cs-report-page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: #fff;
  isolation: isolate;
}
.cs-report-doc {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 297mm;
  padding: 36mm 18mm 32mm 14mm;
}
.cs-report-form-title {
  text-align: center;
  margin-bottom: 10px;
}
.cs-report-form-title h1 {
  font-size: 14px;
  font-weight: 700;
  color: #0f3460;
  margin: 0 0 2px;
}
.cs-report-form-title p {
  font-size: 10px;
  color: #4a6272;
  margin: 0;
}
.cs-report-meta-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
  border: 1px solid #b8cde0;
}
.cs-report-meta-table th,
.cs-report-meta-table td {
  border: 1px solid #d5e3f0;
  padding: 5px 8px;
  font-size: 10px;
  text-align: right;
}
.cs-report-meta-table th {
  background: #eef3f9;
  color: #4a6272;
  width: 22%;
  font-weight: 600;
}
.cs-report-section {
  margin-bottom: 8px;
  page-break-inside: avoid;
  border: 1px solid #d5e3f0;
  background: rgba(255, 255, 255, 0.92);
}
.cs-report-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #0f3460;
  padding: 6px 10px;
  margin: 0;
}
.cs-report-section-title--approval { background: #1a6b5a; }
.cs-report-table {
  width: 100%;
  border-collapse: collapse;
}
.cs-report-table th,
.cs-report-table td {
  border-bottom: 1px solid #d5e3f0;
  padding: 5px 8px;
  vertical-align: middle;
}
.cs-report-table th {
  background: #eef3f9;
  color: #4a6272;
  font-size: 9.5px;
  text-align: right;
  font-weight: 600;
}
.cs-report-table th.center,
.cs-report-table td.center {
  text-align: center;
}
.cs-report-table th.col-a { width: 88px; }
.cs-report-table th.col-b { width: 96px; }
.cs-report-table td.question {
  line-height: 1.45;
  font-size: 10px;
}
.cs-report-mark {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #4a6272;
  border-radius: 1px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.cs-report-mark.checked {
  background: #fff;
  border-color: #0f3460;
  color: #0f3460;
}
.cs-report-remarks-hint {
  padding: 6px 10px;
  border-top: 1px solid #d5e3f0;
  background: #fef3d7;
  font-size: 9.5px;
  color: #784212;
  font-weight: 500;
}
.cs-report-extra-line {
  margin: 0;
  padding: 5px 10px;
  border-top: 1px solid #d5e3f0;
  background: #f7f9fc;
  font-size: 9.5px;
}
.cs-report-remarks {
  padding: 6px 10px;
  border-top: 1px solid #d5e3f0;
  background: #fef3d7;
  font-size: 9.5px;
  line-height: 1.5;
}
.cs-report-remarks-label {
  font-weight: 700;
  display: block;
  margin-bottom: 3px;
  color: #784212;
}
.cs-report-section--approval { border: none; background: transparent; }
.cs-report-section--approval .cs-report-section-title {
  border: 1px solid #d5e3f0;
  border-bottom: none;
}
.cs-report-approval {
  padding: 10px;
  border: 1px solid #d5e3f0;
  border-top: none;
  background: #fff;
}
.cs-report-approval .note {
  padding: 7px 10px;
  background: #d6eaf8;
  border-right: 3px solid #2980b9;
  margin-bottom: 8px;
  line-height: 1.55;
  font-size: 9.5px;
  color: #1a5276;
}
.cs-form-sig-table {
  width: 100%;
  border-collapse: collapse;
}
.cs-form-sig-table th,
.cs-form-sig-table td {
  border: 1px solid #d5e3f0;
  padding: 10px 6px;
  text-align: center;
  font-size: 9.5px;
  vertical-align: middle;
}
.cs-form-sig-table th {
  background: #eef3f9;
  color: #4a6272;
  font-weight: 600;
}
.cs-form-sig-value { font-weight: 600; display: block; }
.cs-form-sig-img {
  display: block;
  margin: 0 auto;
  object-fit: contain;
}
.cs-form-sig-img--signature { max-width: 110px; max-height: 52px; }
.cs-form-sig-img--stamp { max-width: 88px; max-height: 88px; }
@media print {
  @page { size: A4; margin: 0; }
  body { padding: 0; }
  .cs-report-page { padding: 34mm 18mm 28mm 14mm; }
  .cs-report-section { page-break-inside: avoid; }
}
`;
}

function renderMetaTable(model: CaseStudyReportModel): string {
  const esc = escapeCaseStudyReportHtml;
  const locationRow =
    model.propertyLocation || model.propertyType
      ? `<tr>
          ${model.propertyLocation ? `<th>الموقع</th><td>${esc(model.propertyLocation)}</td>` : "<th></th><td></td>"}
          ${model.propertyType ? `<th>نوع العقار</th><td>${esc(model.propertyType)}</td>` : "<th></th><td></td>"}
        </tr>`
      : "";
  const specialistRow =
    model.assignmentSpecialist && model.assignmentSpecialist !== "—"
      ? `<tr><th>أخصائي الإسناد</th><td colspan="3">${esc(model.assignmentSpecialist)}</td></tr>`
      : "";

  return `<table class="cs-report-meta-table"><tbody>
    <tr>
      <th>اسم مزود الخدمة</th><td>${esc(model.providerName)}</td>
      <th>رقم الطلب</th><td>${esc(model.requestNumber)}</td>
    </tr>
    <tr>
      <th>تاريخ الطلب</th><td>${esc(model.requestDate)}</td>
      <th>رقم الصك</th><td>${esc(model.deedNumber)}</td>
    </tr>
    ${locationRow}
    ${specialistRow}
  </tbody></table>`;
}

function renderSections(model: CaseStudyReportModel): string {
  const esc = escapeCaseStudyReportHtml;
  return model.sections
    .map((section) => {
      const rows = section.rows
        .map(
          (row) => `<tr>
            <td class="question">${esc(row.question)}</td>
            <td class="center">${renderCaseStudyReportMark(row.markA)}</td>
            <td class="center">${renderCaseStudyReportMark(row.markB)}</td>
          </tr>`,
        )
        .join("");
      const hint = SECTIONS_WITH_REMARKS_HINT.has(section.id)
        ? `<p class="cs-report-remarks-hint">${esc(CASE_STUDY_SECTION_REMARKS_HINT)}</p>`
        : "";
      const extras = (section.extras ?? [])
        .map((line) => `<p class="cs-report-extra-line">${esc(line)}</p>`)
        .join("");
      const remarks = section.remarks
        ? `<div class="cs-report-remarks"><span class="cs-report-remarks-label">ملاحظات:</span><p>${esc(section.remarks)}</p></div>`
        : "";
      return `<section class="cs-report-section">
        <h2 class="cs-report-section-title">${esc(section.title)}</h2>
        <table class="cs-report-table">
          <thead><tr>
            <th>الأسئلة</th>
            <th class="center col-a">${esc(section.colAHeader)}</th>
            <th class="center col-b">${esc(section.colBHeader)}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${hint}${extras}${remarks}
      </section>`;
    })
    .join("");
}

function renderApproval(
  model: CaseStudyReportModel,
  signatureSrc: string,
  stampSrc: string,
): string {
  const esc = escapeCaseStudyReportHtml;
  return `<section class="cs-report-section cs-report-section--approval">
    <h2 class="cs-report-section-title cs-report-section-title--approval">الاعتماد والتوقيع</h2>
    <div class="cs-report-approval">
      <p class="note">${esc(model.approval.declarationText)}</p>
      <table class="cs-form-sig-table">
        <thead><tr>
          <th>رقم الصك</th><th>معتمد التقرير</th><th>التاريخ</th><th>التوقيع</th><th>ختم الشركة</th>
        </tr></thead>
        <tbody><tr>
          <td><span class="cs-form-sig-value">${esc(model.approval.deedNumber)}</span></td>
          <td><span class="cs-form-sig-value">${esc(model.approval.approverName)}</span></td>
          <td><span class="cs-form-sig-value">${esc(model.approval.reportDate)}</span></td>
          <td><img class="cs-form-sig-img cs-form-sig-img--signature" src="${esc(signatureSrc)}" alt="توقيع معتمد التقرير" /></td>
          <td><img class="cs-form-sig-img cs-form-sig-img--stamp" src="${esc(stampSrc)}" alt="ختم الشركة" /></td>
        </tr></tbody>
      </table>
    </div>
  </section>`;
}

export function buildCaseStudyReportBodyHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const origin = options?.origin;
  const letterhead = options?.letterhead !== false;
  const signatureSrc = caseStudyReportAssetUrl(CASE_STUDY_SIGNATURE_IMAGE, origin);
  const stampSrc = caseStudyReportAssetUrl(CASE_STUDY_STAMP_IMAGE, origin);

  return `<div class="cs-report-page">
  <article class="cs-report-doc">
    <div class="cs-report-form-title">
      <h1>${escapeCaseStudyReportHtml(CASE_STUDY_REPORT_TITLE)}</h1>
      <p>${escapeCaseStudyReportHtml(CASE_STUDY_REPORT_SUBTITLE)}</p>
    </div>
    ${renderMetaTable(model)}
    ${renderSections(model)}
    ${renderApproval(model, signatureSrc, stampSrc)}
  </article>
</div>`;
}

export function buildCaseStudyReportPrintHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const letterhead = options?.letterhead !== false;
  const letterheadUrl = letterhead
    ? caseStudyReportAssetUrl(CASE_STUDY_LETTERHEAD_IMAGE, options?.origin)
    : undefined;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeCaseStudyReportHtml(CASE_STUDY_REPORT_TITLE)} — ${escapeCaseStudyReportHtml(model.deedNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>${caseStudyReportPrintCss(letterheadUrl)}</style>
</head>
<body>
${buildCaseStudyReportBodyHtml(model, options)}
</body>
</html>`;
}
