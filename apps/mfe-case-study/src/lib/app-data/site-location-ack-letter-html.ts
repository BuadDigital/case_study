import { escapeHtml } from "@platform/app-shared/lib/html-escape";
import { openHtmlDocumentInNewTab } from "@platform/app-shared/media/open-html-document";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import {
  caseStudySignatureImage,
  caseStudyStampImage,
} from "./case-study-form-data";
import type { SiteLocationAckLetter } from "./site-location-ack-letter";
import { orgLetterheadUrl } from "./org-letterhead-slices";
import {
  officialLetterFontsHtml,
  officialLetterShellCss,
  officialLetterSignBlockHtml,
  officialLetterToolbarHtml,
} from "./official-letter-layout";

/** Blob print windows need absolute asset URLs. */
function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Pure HTML — same official-letter layout as خطاب التكليف / authorization_letter.html. */
export function siteLocationAckLetterHtml(letter: SiteLocationAckLetter): string {
  const org = getCachedOrganizationSettings();
  const branding = org?.branding ?? null;
  const bg = escapeHtml(assetUrl(orgLetterheadUrl(branding)));
  const stamp = escapeHtml(assetUrl(caseStudyStampImage()));
  const signature = escapeHtml(assetUrl(caseStudySignatureImage()));

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>إقرار صحة الموقع — ${deed}</title>
  ${officialLetterFontsHtml()}
  <style>
    ${officialLetterShellCss()}
    .page { background-image: url("${bg}"); }
    .prop-table { font-size: 12px; }
    .prop-table thead th { font-size: 11.5px; padding: 8px 6px; }
    .prop-table tbody td { padding: 8px 6px; font-size: 11.5px; }
    .map-line {
      margin-top: 5mm;
      font-size: 14px;
      line-height: 2.1;
    }
    .map-line .coords {
      direction: ltr;
      unicode-bidi: plaintext;
      font-weight: 700;
      color: #0F2A4E;
      margin-inline-start: 6px;
    }
    .pledge {
      margin-top: 5mm;
      text-align: justify;
      font-weight: 400;
      line-height: 2.3;
    }
  </style>
</head>
<body>
  ${officialLetterToolbarHtml("إقرار صحة الموقع")}

  <div class="page">
    <div class="ref-meta">
      <div class="row"><span class="label">رقم الصك:</span><span class="value">${deed}</span></div>
      <div class="row"><span class="label">التاريخ:</span><span class="value">${hijri}</span></div>
      <div class="row"><span class="label">الموافق:</span><span class="value">${greg}</span></div>
    </div>

    <div class="letter-body">
      <div class="recipient">
        <span class="honor">إلى من يهمه الأمر</span>
        <span class="resp">المحترمين</span>
      </div>

      <div class="salutation">السلام عليكم ورحمة الله وبركاته،</div>
      <div class="subject"><span class="lbl">الموضوع/</span> إقرار صحة الموقع</div>

      <div class="letter-text">
        أقر أنا <span class="b">${name}</span>
        سجل مدني رقم <span class="b">${civilId}</span>
        جوال رقم <span class="b">${phone}</span>
        بصفتي <span class="b">${capacity}</span>
        بموجب الطلب رقم <span class="b">${request}</span>
        أن هذا هو موقع العقار المراد تقييمه والمملوك بموجب الصك رقم
        <span class="b">${deed}</span>
        الواقع بمدينة <span class="b">${city}</span>،
        وأتحمل مسؤولية صحة الموقع.
      </div>

      <table class="prop-table">
        <thead>
          <tr>
            <th>رقم الصك</th>
            <th>المدينة</th>
            <th>الحي</th>
            <th>رقم المخطط</th>
            <th>رقم القطعة</th>
            <th>الإحداثيات</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${deed}</td>
            <td class="ar-cell">${city}</td>
            <td class="ar-cell">${district}</td>
            <td>${plan}</td>
            <td>${plot}</td>
            <td>شماليات ${north}<br />شرقيات ${east}</td>
          </tr>
        </tbody>
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

      ${officialLetterSignBlockHtml({ stampUrl: stamp, signatureUrl: signature })}
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
