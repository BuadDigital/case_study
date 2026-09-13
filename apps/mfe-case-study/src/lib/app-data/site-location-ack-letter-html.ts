import { escapeHtml } from "@platform/app-shared/lib/html-escape";
import { openHtmlDocumentInNewTab } from "@platform/app-shared/media/open-html-document";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import {
  caseStudyProviderName,
  caseStudySignatureImage,
  caseStudyStampImage,
} from "./case-study-form-data";
import type { SiteLocationAckLetter } from "./site-location-ack-letter";
import {
  ORG_LETTERHEAD_SLICES_HTML,
  orgLetterheadContentCss,
  orgLetterheadLayout,
  orgLetterheadSliceCss,
  orgLetterheadUrl,
} from "./org-letterhead-slices";

const NAVY = "#0F2A4E";
const MUTED = "#555";

/** Blob print windows need absolute asset URLs. */
function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Pure HTML for tests / preview — org branding letterhead, site-ack body. */
export function siteLocationAckLetterHtml(letter: SiteLocationAckLetter): string {
  const org = getCachedOrganizationSettings();
  const branding = org?.branding ?? null;
  const layout = orgLetterheadLayout(branding);
  const bg = escapeHtml(assetUrl(orgLetterheadUrl(branding)));
  const stamp = escapeHtml(assetUrl(caseStudyStampImage()));
  const signature = escapeHtml(assetUrl(caseStudySignatureImage()));
  const company = escapeHtml(caseStudyProviderName());

  const deed = escapeHtml(letter.deedNumber);
  const hijri = escapeHtml(letter.dateHijri);
  const greg = escapeHtml(letter.dateGreg);
  const name = escapeHtml(letter.contactName);
  const civilId = escapeHtml(letter.civilId);
  const phone = escapeHtml(letter.contactPhone);
  const capacity = escapeHtml(letter.capacity);
  const request = escapeHtml(letter.requestNumber);
  const city = escapeHtml(letter.city);
  const district = escapeHtml(letter.district);
  const plan = escapeHtml(letter.planNumber);
  const plot = escapeHtml(letter.plotNumber);
  const north = escapeHtml(letter.north);
  const east = escapeHtml(letter.east);
  const coords = escapeHtml(letter.coords);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>إقرار صحة الموقع — ${deed}</title>
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
      font-size: 13px;
      line-height: 1.85;
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
      height: 297mm;
      margin: 0 auto;
      background: #fff;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(15,42,78,.15);
      color: ${NAVY};
    }
    ${orgLetterheadSliceCss(bg, layout)}
    ${orgLetterheadContentCss(
      layout,
      "display: flex; flex-direction: column; gap: 2.5mm;",
    )}
    .meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11.5px;
      line-height: 1.7;
    }
    .meta .row {
      display: flex;
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
    .titles {
      text-align: center;
      margin: 1mm 0 2mm;
    }
    .titles h1 {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 2px;
    }
    .titles h2 {
      font-size: 12.5px;
      font-weight: 600;
      color: ${MUTED};
      margin: 0;
    }
    .body {
      font-size: 12.5px;
      line-height: 1.95;
      text-align: justify;
    }
    .body .b { font-weight: 700; }
    .facts {
      width: 100%;
      border-collapse: collapse;
      margin: 1mm 0;
      font-size: 11.5px;
    }
    .facts th, .facts td {
      border: 1px solid #d5dbe6;
      padding: 5px 9px;
      text-align: right;
      vertical-align: top;
    }
    .facts th {
      width: 28%;
      background: #f7f5f1;
      font-weight: 700;
      color: ${MUTED};
    }
    .facts td { font-weight: 600; }
    .coords-pair {
      display: flex;
      flex-direction: column;
      gap: 2px;
      direction: ltr;
      unicode-bidi: plaintext;
      text-align: left;
      font-variant-numeric: tabular-nums;
    }
    .map-line {
      margin: 0.5mm 0 1mm;
      font-size: 12px;
    }
    .map-line .coords {
      direction: ltr;
      unicode-bidi: plaintext;
      font-weight: 700;
      margin-inline-start: 6px;
    }
    .pledge {
      font-size: 12px;
      line-height: 1.9;
      text-align: justify;
    }
    .sign {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-top: auto;
      padding-top: 4mm;
      font-size: 11.5px;
    }
    .sign-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: flex-start;
    }
    .sign-label { font-weight: 700; color: ${MUTED}; }
    .sign-value { font-weight: 700; min-height: 1.4em; }
    .sign-box img {
      display: block;
      max-height: 52px;
      max-width: 120px;
      object-fit: contain;
    }
    .company-note {
      margin-top: 2mm;
      font-size: 10px;
      color: ${MUTED};
      text-align: center;
    }
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
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
        height: 297mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>إقرار صحة الموقع</span>
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
    ${ORG_LETTERHEAD_SLICES_HTML}
    <div class="content">
      <div class="meta">
        <div class="row"><span class="label">رقم الصك:</span><span class="value">${deed}</span></div>
        <div class="row"><span class="label">التاريخ:</span><span class="value">${hijri}</span></div>
        <div class="row"><span class="label">الموافق:</span><span class="value">${greg}</span></div>
      </div>

      <div class="titles">
        <h1>خطاب إقرار صحة الموقع</h1>
        <h2>إقرار بتحمل المسؤولية</h2>
      </div>

      <p class="body">
        أقر أنا <span class="b">${name}</span>
        سجل مدني رقم <span class="b">${civilId}</span>
        جوال رقم <span class="b">${phone}</span>
        بصفتي <span class="b">${capacity}</span>
        بموجب الطلب رقم <span class="b">${request}</span>
        أن هذا هو موقع العقار المراد تقييمه والمملوك بموجب الصك رقم
        <span class="b">${deed}</span>
        الواقع بمدينة <span class="b">${city}</span>،
        وأتحمل مسؤولية صحة الموقع.
      </p>

      <table class="facts">
        <tr><th>رقم الصك</th><td dir="ltr">${deed}</td></tr>
        <tr><th>المدينة</th><td>${city}</td></tr>
        <tr><th>الحي</th><td>${district}</td></tr>
        <tr><th>رقم المخطط</th><td dir="ltr">${plan}</td></tr>
        <tr><th>رقم القطعة</th><td dir="ltr">${plot}</td></tr>
        <tr>
          <th>الإحداثيات</th>
          <td>
            <div class="coords-pair">
              <span>شماليات ${north}</span>
              <span>شرقيات ${east}</span>
            </div>
          </td>
        </tr>
      </table>

      <div class="map-line">
        موقع العقار على الخريطة
        <span class="coords">${coords}</span>
      </div>

      <p class="pledge">
        كما أتعهد بأنني سأكون مسؤولاً عن أي خطأ أو ضرر ناتج في حال تبين عدم دقتها أو مخالفتها للواقع.
        وأتحمل كافة المسؤوليات القانونية عن أي تأثيرات أو مشاكل قد تطرأ نتيجة لهذه الأعمال،
        سواء كانت ذات طابع قانوني أو فني أو غيره.
      </p>

      <div class="sign">
        <div class="sign-box">
          <div class="sign-label">الاسم:</div>
          <div class="sign-value">${name}</div>
        </div>
        <div class="sign-box">
          <div class="sign-label">التوقيع:</div>
          <img src="${signature}" alt="التوقيع" />
        </div>
        <div class="sign-box">
          <div class="sign-label">التاريخ:</div>
          <div class="sign-value">${greg}</div>
          <div class="sign-label" style="margin-top:8px">الختم</div>
          <img src="${stamp}" alt="ختم الشركة" />
        </div>
      </div>

      <div class="company-note">${company}</div>
    </div>
  </div>
</body>
</html>`;
}

export function printSiteLocationAckLetter(
  letter: SiteLocationAckLetter,
  options?: { target?: Window | null },
): boolean {
  return openHtmlDocumentInNewTab(siteLocationAckLetterHtml(letter), {
    waitForImages: true,
    waitForFonts: true,
    target: options?.target,
  });
}

/**
 * Opens the printable acknowledgment after warming org branding.
 * Caller must open `target` synchronously inside the click handler when awaiting.
 */
export async function openSiteLocationAckLetter(
  letter: SiteLocationAckLetter,
  options?: { target?: Window | null },
): Promise<boolean> {
  await ensureOrganizationSettingsLoaded();
  return printSiteLocationAckLetter(letter, options);
}
