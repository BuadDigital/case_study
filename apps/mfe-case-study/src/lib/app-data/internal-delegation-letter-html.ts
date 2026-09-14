import type {
  DelegationAgentInfo,
  InternalDelegationLetter,
} from "./internal-delegation-letters";
import { openHtmlDocumentInNewTab } from "../open-html-document";
import {
  caseStudyProviderName,
  caseStudySignatureImage,
  caseStudyStampImage,
} from "./case-study-form-data";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import { escapeHtml } from "@platform/app-shared/lib/html-escape";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "./po-intake-data";
import { orgLetterheadUrl } from "./org-letterhead-slices";
import {
  officialLetterFontsHtml,
  officialLetterShellCss,
  officialLetterSignBlockHtml,
  officialLetterToolbarHtml,
} from "./official-letter-layout";

const DEFAULT_COMPANY_CR = "4030297680";

/** Blob print windows need absolute asset URLs. */
function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Pure HTML — layout matches `docs/مراجع حكومي/authorization_letter.html`. */
export function internalDelegationLetterHtml(
  letter: InternalDelegationLetter,
  agentFallback?: DelegationAgentInfo,
): string {
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
  const org = getCachedOrganizationSettings();
  const branding = org?.branding ?? null;
  const companyName = caseStudyProviderName();
  const companyCr =
    org?.company.commercialRegistration?.trim() || DEFAULT_COMPANY_CR;
  const bg = escapeHtml(assetUrl(orgLetterheadUrl(branding)));
  const stamp = escapeHtml(assetUrl(caseStudyStampImage()));
  const signature = escapeHtml(assetUrl(caseStudySignatureImage()));

  const rows = rowsSource
    .map(
      (p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(p.workOrder || "—")}</td>
          <td>${escapeHtml(p.deedNo || "—")}</td>
          <td class="ar-cell">${escapeHtml(p.owner || "—")}</td>
          <td>${escapeHtml(p.requestNo || "—")}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>خطاب تكليف — ${escapeHtml(reference)}</title>
  ${officialLetterFontsHtml()}
  <style>
    ${officialLetterShellCss()}
    .page { background-image: url("${bg}"); }
  </style>
</head>
<body>
  ${officialLetterToolbarHtml("خطاب التكليف الداخلي")}

  <div class="page">
    <div class="ref-meta">
      <div class="row"><span class="label">رقم المرجع:</span><span class="value">${escapeHtml(reference)}</span></div>
      <div class="row"><span class="label">التاريخ:</span><span class="value">${escapeHtml(dateHijri)}</span></div>
      <div class="row"><span class="label">الموافق:</span><span class="value">${escapeHtml(dateGreg)}</span></div>
    </div>

    <div class="letter-body">
      <div class="recipient">
        <span class="honor">فضيلة رئيس محكمة التنفيذ — ${escapeHtml(city)}</span>
        <span class="resp">المحترم</span>
      </div>

      <div class="salutation">السلام عليكم ورحمة الله وبركاته،</div>
      <div class="subject"><span class="lbl">الموضوع/</span> تكليف</div>

      <div class="court-line">
        <span class="cl-label">المحكمة / الدائرة:</span>
        <span class="cl-value">${escapeHtml(court)} / ${escapeHtml(circuit)}</span>
      </div>

      <div class="letter-text">
        بالإشارة إلى الموضوع أعلاه وبناءً على التكليف الصادر من مركز الإسناد والتصفية (إنفاذ) المذكورة أدناه، نفوض نحن
        <span class="b"> ${escapeHtml(companyName)} </span>
        سجل تجاري رقم <span class="b">${escapeHtml(companyCr)}</span>
        السيد <span class="b">${escapeHtml(agentName)}</span>
        <span class="b">${escapeHtml(agentNationality)}</span> الجنسية،
        ويحمل الهوية الوطنية رقم <span class="b">${escapeHtml(agentId)}</span>
        ورقم جوال <span class="b">${escapeHtml(agentMobile)}</span>
        لاستلام <span class="b">مفاتيح العقارات</span> بمحافظة
        <span class="b">${escapeHtml(city)}</span> والمحافظات التابعة لها.
      </div>

      <table class="prop-table">
        <thead>
          <tr>
            <th style="width:34px">م</th>
            <th style="width:70px">أمر العمل</th>
            <th style="width:120px">${PROPERTY_IDENTIFIER_COLUMN_LABEL}</th>
            <th>المالك</th>
            <th style="width:135px">رقم الطلب</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" class="ar-cell">لا توجد عقارات</td></tr>`}</tbody>
      </table>

      ${officialLetterSignBlockHtml({ stampUrl: stamp, signatureUrl: signature })}
    </div>
  </div>
</body>
</html>`;
}

export function printInternalDelegationLetter(
  letter: InternalDelegationLetter,
  agentFallback?: DelegationAgentInfo,
): void {
  openHtmlDocumentInNewTab(internalDelegationLetterHtml(letter, agentFallback), {
    waitForImages: true,
    waitForFonts: true,
  });
}

/** Opens after warming org branding so letterhead matches الهوية البصرية. */
export async function openInternalDelegationLetter(
  letter: InternalDelegationLetter,
  agentFallback?: DelegationAgentInfo,
): Promise<void> {
  await ensureOrganizationSettingsLoaded();
  printInternalDelegationLetter(letter, agentFallback);
}
