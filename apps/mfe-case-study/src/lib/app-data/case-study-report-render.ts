import {
  CASE_STUDY_REPORT_SUBTITLE,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_REMARKS_HINT,
  caseStudySignatureImage,
  caseStudyStampImage,
} from "./case-study-form-data";
import type {
  CaseStudyReportModel,
  CaseStudyReportSection,
} from "./case-study-report-model";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "./po-intake-data";
import { getCachedOrganizationBranding } from "@platform/app-shared/organization/organization-settings-cache";
import {
  orgLetterheadLayout,
  orgLetterheadSliceCss,
  orgLetterheadUrl,
} from "./org-letterhead-slices";
import {
  officialLetterFontsHtml,
  officialLetterShellCss,
  officialLetterToolbarHtml,
} from "./official-letter-layout";
import { caseStudyReportPaginateScript } from "./case-study-report-paginate";

export type CaseStudyReportRenderOptions = {
  origin?: string;
  /** CS-{year}-{seq} — printed under the title once allocated (Decision 25, entity 6). */
  referenceNumber?: string | null;
  /** Drop the print toolbar when the page is shown inside the app's own preview modal. */
  embedded?: boolean;
};

const EXTRA_SUB_NOTE_DEFAULT =
  "في حال وجود اختلاف يتم التوضيح في الملاحظات ادناه / لا يوجد";

export function caseStudyReportAssetUrl(
  path: string,
  origin?: string,
): string {
  if (!origin) return path;
  // An uploaded signature/stamp is a data: URL and a hosted one is absolute — only a
  // site-relative path needs the origin (report opens as a blob: page with no base).
  if (!path.startsWith("/")) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

import { escapeHtml as escapeCaseStudyReportHtml } from "@platform/app-shared/lib/html-escape";
export { escapeCaseStudyReportHtml };

function renderCb(checked: boolean): string {
  return `<span class="csrd-cb${checked ? " csrd-cb--on" : ""}" aria-hidden="true">${checked ? "☑" : "☐"}</span>`;
}

function renderCommissionTable(model: CaseStudyReportModel): string {
  const esc = escapeCaseStudyReportHtml;
  const rows = [
    `<tr><td class="csrd-data-lbl">اسم مزود الخدمة</td><td>${esc(model.providerName)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">رقم الطلب</td><td class="csrd-ltr">${esc(model.requestNumber)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">تاريخ الطلب</td><td class="csrd-ltr">${esc(model.requestDate)}</td></tr>`,
    `<tr><td class="csrd-data-lbl">${PROPERTY_IDENTIFIER_COLUMN_LABEL}</td><td class="csrd-ltr">${esc(model.deedNumber)}</td></tr>`,
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
      const noteText = row.note?.trim();
      const hasSub = section.id === "extra" || Boolean(noteText);
      const main = `<tr${hasSub ? ' class="csrd-q-row--noted"' : ""}>
        <td>${esc(row.question)}${occSuffix}</td>
        <td class="csrd-yn">${renderCb(row.markA)}</td>
        <td class="csrd-yn">${renderCb(row.markB)}</td>
      </tr>`;
      const sub = hasSub
        ? `<tr class="csrd-sub-row"><td colspan="3">${esc(
            noteText || EXTRA_SUB_NOTE_DEFAULT,
          )}</td></tr>`
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
        <th style="width:22%">${PROPERTY_IDENTIFIER_COLUMN_LABEL}:</th>
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
  direction: rtl;
}
.csrd-root {
  --navy:#0f2a4e; --gold:#a38f67; --border:#c8c8c8; --row-alt:#f9fafc;
  --sub-bg:#f5f6f8; --approval-bg:#f8f9fa; --yellow-bg:#fffbeb; --yellow-bdr:#e5c84a;
  --yellow-text:#7a5f00; --text:#1c1c1c; --text-muted:#5a5a5a; --white:#fff;
  font-size:9.5pt; line-height:1.45; color:var(--text); direction:rtl;
  display:flex; flex-direction:column; align-items:center; gap:16px;
}
/* Measuring area: same width as a sheet's content box, laid out but never shown. It must not
   sit off-screen to the left — in an RTL page that makes the page scroll sideways forever. */
.csrd-flow {
  position:absolute; top:0; right:0; visibility:hidden; height:0; overflow:hidden;
  width:calc(210mm - var(--lh-start) - var(--lh-end) - 8mm);
}
.csrd-flow > * { display:flow-root; }
.csrd-root:not([data-paginated]) .csrd-flow {
  position:static; visibility:visible; height:auto; overflow:visible;
  width:180mm; background:#fff; padding:10mm;
}
.csrd-sheets { display:flex; flex-direction:column; align-items:center; gap:16px; }
.csrd-sheet {
  position:relative; width:210mm; height:297mm; overflow:hidden; background:#fff;
  box-shadow:0 4px 24px rgba(15,42,78,.15);
}
.csrd-sheet-content {
  position:absolute; z-index:1; background:#fff;
  top:var(--lh-head); bottom:var(--lh-foot); right:var(--lh-start); left:var(--lh-end);
  padding:5mm 4mm; overflow:hidden;
}
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
/* A note belongs to the question above it — no rule between them. */
.csrd-table .csrd-q-row--noted td { border-bottom:none; }
.csrd-table .csrd-sub-row td { background:var(--sub-bg); font-size:8.5pt; color:var(--text-muted); font-style:italic; border-top:none; }
.csrd-table .csrd-notes-row td { background:var(--approval-bg); font-size:9pt; line-height:1.55; }
.csrd-notes-label { display:block; font-weight:700; color:var(--navy); margin-bottom:2px; }
.csrd-cb { font-size:14px; display:inline-block; width:18px; text-align:center; color:#444; }
.csrd-cb--on { color:var(--navy); font-size:15px; }
.csrd-approval-decl { background:var(--approval-bg); border-right:4px solid var(--gold); padding:7px 12px; font-size:9.5pt; margin-bottom:3mm; line-height:1.5; }
.csrd-approval-table th { background:var(--navy); color:#fff; font-size:9.5pt; font-weight:600; text-align:center; }
.csrd-approval-table td { height:26mm; text-align:center; vertical-align:middle; }
.csrd-approval-table img { max-height:22mm; max-width:100%; object-fit:contain; display:block; margin:0 auto; }
@media print {
  .csrd-root { display:block; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .csrd-flow { display:none !important; }
  .csrd-sheets { display:block; }
  .csrd-sheet { box-shadow:none; margin:0; page-break-after:always; break-after:page; }
  .csrd-sheet:last-child { page-break-after:auto; break-after:auto; }
}
`;
}

export function buildCaseStudyReportBodyHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const origin = options?.origin;
  const signatureSrc = caseStudyReportAssetUrl(
    caseStudySignatureImage(),
    origin,
  );
  const stampSrc = caseStudyReportAssetUrl(caseStudyStampImage(), origin);
  const esc = escapeCaseStudyReportHtml;
  const layout = orgLetterheadLayout(getCachedOrganizationBranding());
  const reference = options?.referenceNumber?.trim();
  const referenceHtml = reference
    ? `
    <div class="csrd-title-sub csrd-ltr" dir="ltr">${esc(reference)}</div>`
    : "";

  return `<div class="csrd-root" lang="ar" dir="rtl" style="--lh-head:${layout.headMm}mm;--lh-foot:${layout.footMm}mm;--lh-start:${layout.startMm}mm;--lh-end:${layout.endMm}mm">
<div class="csrd-flow">
  <div class="csrd-title-block">
    <div class="csrd-title-main">${esc(CASE_STUDY_REPORT_TITLE)}</div>
    <div class="csrd-title-sub">${esc(CASE_STUDY_REPORT_SUBTITLE)}</div>${referenceHtml}
  </div>
  ${renderCommissionTable(model)}
  ${model.sections.map(renderSection).join("")}
  ${renderApproval(model, signatureSrc, stampSrc)}
</div>
<div class="csrd-sheets"></div>
</div>`;
}

export function buildCaseStudyReportPrintHtml(
  model: CaseStudyReportModel,
  options?: CaseStudyReportRenderOptions,
): string {
  const esc = escapeCaseStudyReportHtml;
  const branding = getCachedOrganizationBranding();
  const layout = orgLetterheadLayout(branding);
  const letterhead = esc(
    caseStudyReportAssetUrl(orgLetterheadUrl(branding), options?.origin),
  );
  const toolbar = options?.embedded
    ? ""
    : officialLetterToolbarHtml(CASE_STUDY_REPORT_TITLE);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(CASE_STUDY_REPORT_TITLE)} — ${esc(model.deedNumber)}</title>
${officialLetterFontsHtml()}
<style>${officialLetterShellCss()}${caseStudyReportPrintCss()}${orgLetterheadSliceCss(letterhead, layout)}</style>
</head>
<body>
${toolbar}
${buildCaseStudyReportBodyHtml(model, options)}
<script>${caseStudyReportPaginateScript()}</script>
</body>
</html>`;
}
