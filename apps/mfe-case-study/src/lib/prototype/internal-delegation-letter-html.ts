import type {
  DelegationAgentInfo,
  InternalDelegationLetter,
} from "./internal-delegation-letters";
import { openHtmlDocumentInNewTab } from "../open-html-document";
import {
  CASE_STUDY_SIGNATURE_IMAGE,
  CASE_STUDY_STAMP_IMAGE,
} from "./case-study-form-data";

const COMPANY_NAME = "شركة إجادة المهنية للتقييم";
const COMPANY_CR = "4030297680";
const LETTERHEAD_PATH = "/case-study/ejadah-letterhead.png";
const NAVY = "#0F2A4E";
const MUTED = "#555";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Blob print windows need absolute asset URLs. */
function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function printInternalDelegationLetter(
  letter: InternalDelegationLetter,
  agentFallback?: DelegationAgentInfo,
): void {
  const rowsSource =
    letter.issuedProperties && letter.issuedProperties.length > 0
      ? letter.issuedProperties
      : letter.selectedProperties;
  const agent = letter.agent ?? agentFallback;
  const reference = letter.reference?.trim() || "—";
  const dateHijri = letter.dateHijri?.trim() || "—";
  const dateGreg = letter.dateGreg?.trim() || "—";
  const city = letter.city.trim() || "—";
  const court = letter.court.trim() || "—";
  const circuit = letter.circuit.trim() || "—";
  const agentName = agent?.name?.trim() || "—";
  const agentNationality = agent?.nationality?.trim() || "—";
  const agentId = agent?.nationalId?.trim() || "—";
  const agentMobile = agent?.mobile?.trim() || "—";
  const bg = escapeHtml(assetUrl(LETTERHEAD_PATH));
  const stamp = escapeHtml(assetUrl(CASE_STUDY_STAMP_IMAGE));
  const signature = escapeHtml(assetUrl(CASE_STUDY_SIGNATURE_IMAGE));

  const rows = rowsSource
    .map(
      (p, i) => `
      <tr>
        <td class="col-seq">${i + 1}</td>
        <td class="col-num" dir="ltr">${escapeHtml(p.workOrder || "—")}</td>
        <td class="col-deed" dir="ltr">${escapeHtml(p.deedNo || "—")}</td>
        <td class="col-owner">${escapeHtml(p.owner || "—")}</td>
        <td class="col-req" dir="ltr">${escapeHtml(p.requestNo || "—")}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>خطاب تفويض — ${escapeHtml(reference)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "IBM Plex Sans Arabic", sans-serif;
      font-size: 14px;
      line-height: 2.1;
      font-weight: 400;
      background: #e9ecf1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      min-height: 100vh;
    }
    .toolbar {
      position: sticky;
      top: 16px;
      z-index: 20;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #fff;
      padding: 12px 18px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(15,42,78,.12);
    }
    .toolbar span {
      font-size: 13px;
      color: ${MUTED};
      font-weight: 500;
    }
    .btn {
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 9px 20px;
      border-radius: 7px;
      border: none;
      cursor: pointer;
      background: ${NAVY};
      color: #fff;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .btn:hover { background: #163a63; }
    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 4px 24px rgba(15,42,78,.15);
    }
    .letterhead {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: fill;
      z-index: 0;
      pointer-events: none;
    }
    .content {
      position: relative;
      z-index: 1;
      padding: 50mm 24mm 42mm;
      min-height: 297mm;
    }
    .meta {
      position: absolute;
      top: 26mm;
      right: 24mm;
      direction: rtl;
      text-align: right;
      font-size: 11px;
      line-height: 1.85;
    }
    .meta .row {
      display: flex;
      flex-direction: row;
      gap: 6px;
      justify-content: flex-start;
    }
    .meta .label { font-weight: 600; color: ${MUTED}; }
    .meta .value {
      font-weight: 700;
      direction: ltr;
      unicode-bidi: plaintext;
      color: ${NAVY};
    }
    .to {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-weight: 700;
      font-size: 15px;
      margin: 0 0 8mm;
    }
    .greeting {
      font-weight: 600;
      margin: 0 0 4px;
    }
    .subject {
      margin: 0 0 6mm;
      font-weight: 700;
    }
    .court-line {
      display: flex;
      gap: 8px;
      align-items: baseline;
      margin: 0 0 6mm;
      font-size: 14px;
    }
    .court-line .cl-label { font-weight: 600; color: ${MUTED}; }
    .court-line .cl-value { font-weight: 700; color: ${NAVY}; }
    .body {
      text-align: justify;
      margin: 0 0 7mm;
      font-weight: 400;
      line-height: 2.3;
    }
    .body .b { font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
      margin-top: 7mm;
    }
    th, td {
      border: 1px solid #cdd4de;
      padding: 9px 8px;
      vertical-align: middle;
      text-align: center;
    }
    th {
      background: ${NAVY};
      color: #fff;
      font-weight: 600;
      font-size: 12.5px;
      border-color: ${NAVY};
    }
    td {
      font-weight: 500;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    table tbody tr:nth-child(even) td { background: #f6f8fb; }
    .col-seq { width: 34px; white-space: nowrap; }
    .col-num { width: 70px; white-space: nowrap; }
    .col-deed { width: 120px; white-space: nowrap; }
    .col-owner {
      width: auto;
      text-align: right;
      direction: rtl;
      unicode-bidi: normal;
      font-size: 11px;
      line-height: 1.5;
      white-space: normal;
      word-break: break-word;
      padding: 9px 10px;
    }
    .col-req { width: 135px; white-space: nowrap; }
    .sign {
      margin-top: 14mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 40px;
    }
    .sign-box {
      text-align: center;
      min-width: 140px;
      min-height: 72px;
    }
    .sign-label {
      font-size: 12px;
      color: ${MUTED};
      font-weight: 600;
      margin-bottom: 8px;
    }
    .sign-box img {
      display: block;
      margin: 0 auto;
      max-height: 64px;
      max-width: 140px;
      object-fit: contain;
    }
    @media print {
      html, body {
        width: 210mm;
        min-height: 297mm;
        background: #fff;
        padding: 0;
        gap: 0;
        margin: 0;
        display: block;
      }
      .toolbar { display: none !important; }
      .page {
        box-shadow: none;
        width: 210mm;
        min-height: 297mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>خطاب تفويض داخلي</span>
    <button type="button" class="btn" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="6,9 6,2 18,2 18,9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
      طباعة / حفظ PDF
    </button>
  </div>
  <div class="page">
    <img class="letterhead" src="${bg}" alt="" />
    <div class="content">
      <div class="meta">
        <div class="row"><span class="label">رقم المرجع:</span><span class="value">${escapeHtml(reference)}</span></div>
        <div class="row"><span class="label">التاريخ:</span><span class="value">${escapeHtml(dateHijri)}</span></div>
        <div class="row"><span class="label">الموافق:</span><span class="value">${escapeHtml(dateGreg)}</span></div>
      </div>

      <div class="to">
        <span>فضيلة رئيس محكمة التنفيذ — ${escapeHtml(city)}</span>
        <span>المحترم</span>
      </div>

      <div class="greeting">السلام عليكم ورحمة الله وبركاته،</div>
      <div class="subject">الموضوع/ تفويض</div>
      <div class="court-line">
        <span class="cl-label">المحكمة / الدائرة:</span>
        <span class="cl-value">${escapeHtml(court)} / ${escapeHtml(circuit)}</span>
      </div>

      <p class="body">
        بالإشارة إلى الموضوع أعلاه وبناءً على التفويض الصادر من مركز الإسناد والتصفية (إنفاذ) المذكورة أدناه،
        نفوض نحن <span class="b">${escapeHtml(COMPANY_NAME)}</span>
        سجل تجاري رقم <span class="b">${escapeHtml(COMPANY_CR)}</span>
        السيد <span class="b">${escapeHtml(agentName)}</span>
        <span class="b">${escapeHtml(agentNationality)}</span> الجنسية،
        ويحمل الهوية الوطنية رقم <span class="b">${escapeHtml(agentId)}</span>
        ورقم جوال <span class="b">${escapeHtml(agentMobile)}</span>
        لاستلام <span class="b">مفاتيح العقارات</span> بمحافظة
        <span class="b">${escapeHtml(city)}</span> والمحافظات التابعة لها.
      </p>

      <table>
        <thead>
          <tr>
            <th class="col-seq">م</th>
            <th class="col-num">أمر العمل</th>
            <th class="col-deed">رقم الصك</th>
            <th class="col-owner">المالك</th>
            <th class="col-req">رقم الطلب</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="sign">
        <div class="sign-box">
          <div class="sign-label">الختم</div>
          <img src="${stamp}" alt="ختم الشركة" />
        </div>
        <div class="sign-box">
          <div class="sign-label">التوقيع</div>
          <img src="${signature}" alt="التوقيع" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  openHtmlDocumentInNewTab(html, { waitForImages: true, waitForFonts: true });
}
