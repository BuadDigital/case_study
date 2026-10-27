/**
 * Shared A4 official-letter chrome matching
 * `docs/مراجع حكومي/authorization_letter.html`.
 *
 * Full-bleed letterhead background + padded content clear of header/footer.
 */

const OFFICIAL_LETTER_NAVY = "#0F2A4E";
const OFFICIAL_LETTER_MUTED = "#555";
const OFFICIAL_LETTER_INK = "#1a1a1a";

/** Default pads that clear the Ejadah letterhead bands (mm). */
const OFFICIAL_LETTER_PAD = {
  topMm: 50,
  bottomMm: 42,
  sideMm: 24,
  refTopMm: 26,
} as const;

export function officialLetterShellCss(options?: {
  padTopMm?: number;
  padBottomMm?: number;
  padSideMm?: number;
  refTopMm?: number;
}): string {
  const navy = OFFICIAL_LETTER_NAVY;
  const muted = OFFICIAL_LETTER_MUTED;
  const ink = OFFICIAL_LETTER_INK;
  const padTop = options?.padTopMm ?? OFFICIAL_LETTER_PAD.topMm;
  const padBottom = options?.padBottomMm ?? OFFICIAL_LETTER_PAD.bottomMm;
  const padSide = options?.padSideMm ?? OFFICIAL_LETTER_PAD.sideMm;
  const refTop = options?.refTopMm ?? OFFICIAL_LETTER_PAD.refTopMm;

  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      margin: 0;
      padding: 0;
      color: ${ink};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      /* Phone browsers must not enlarge the letter's text on their own. */
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    body {
      font-family: "IBM Plex Sans Arabic", sans-serif;
      background: #e9ecf1;
      color: ${ink};
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
      box-shadow: 0 2px 10px rgba(15,42,78,.1);
    }
    .toolbar span {
      font-size: 13px;
      color: ${muted};
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
      background: ${navy};
      color: #fff;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .btn:hover { background: #163a63; }
    .page {
      width: 210mm;
      height: 297mm;
      background-color: #fff;
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
      box-shadow: 0 4px 24px rgba(15,42,78,.15);
      padding: ${padTop}mm ${padSide}mm ${padBottom}mm;
      overflow: hidden;
    }
    .ref-meta {
      position: absolute;
      top: ${refTop}mm;
      right: ${padSide}mm;
      direction: rtl;
      text-align: right;
      font-size: 11px;
      line-height: 1.85;
    }
    .ref-meta .row {
      display: flex;
      flex-direction: row;
      gap: 6px;
      justify-content: flex-start;
    }
    .ref-meta .label { font-weight: 600; color: ${muted}; }
    .ref-meta .value {
      font-weight: 700;
      direction: ltr;
      unicode-bidi: plaintext;
      color: ${navy};
    }
    .letter-body {
      font-size: 14px;
      line-height: 2.1;
      color: ${ink};
    }
    .recipient {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 8mm;
    }
    .salutation { font-weight: 600; margin-bottom: 4px; }
    .subject { font-weight: 700; margin-bottom: 6mm; }
    .court-line {
      display: flex;
      gap: 8px;
      align-items: baseline;
      margin-bottom: 6mm;
      font-size: 14px;
    }
    .court-line .cl-label { font-weight: 600; color: ${muted}; }
    .court-line .cl-value { font-weight: 700; color: ${navy}; }
    .letter-text {
      text-align: justify;
      font-weight: 400;
      line-height: 2.3;
    }
    .letter-text .b { font-weight: 700; }
    .prop-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 7mm;
      font-size: 13px;
    }
    .prop-table thead th {
      background: ${navy};
      color: #fff;
      font-weight: 600;
      padding: 9px 8px;
      text-align: center;
      font-size: 12.5px;
      border: 1px solid ${navy};
    }
    .prop-table tbody td {
      padding: 9px 8px;
      text-align: center;
      border: 1px solid #cdd4de;
      font-weight: 500;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .prop-table tbody td.ar-cell {
      direction: rtl;
      font-size: 11px;
      line-height: 1.5;
      text-align: right;
      padding: 9px 10px;
    }
    .prop-table tbody tr:nth-child(even) td { background: #f6f8fb; }
    .facts-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 7mm;
      font-size: 13px;
    }
    .facts-table th, .facts-table td {
      border: 1px solid #cdd4de;
      padding: 9px 10px;
      text-align: right;
      vertical-align: top;
    }
    .facts-table th {
      width: 32%;
      background: ${navy};
      color: #fff;
      font-weight: 600;
      font-size: 12.5px;
      border-color: ${navy};
    }
    .facts-table td {
      font-weight: 500;
      background: #fff;
    }
    .facts-table tr:nth-child(even) td { background: #f6f8fb; }
    .facts-table td.ltr {
      direction: ltr;
      unicode-bidi: plaintext;
      text-align: left;
    }
    .sign-block {
      margin-top: 10mm;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 12mm;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
    }
    .sign-item {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      align-items: center;
    }
    .sign-caption {
      font-size: 12px;
      color: ${muted};
      font-weight: 600;
      line-height: 1.2;
    }
    .stamp-slot, .signature-slot {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      color: #aab3c0;
      font-size: 10px;
      text-align: center;
      overflow: hidden;
      width: 46mm;
      height: 24mm;
    }
    .stamp-slot {
      border: 1px dashed #c5ccd6;
      border-radius: 4px;
      padding: 2px;
    }
    .signature-slot {
      border-bottom: 1px solid #c5ccd6;
      padding-bottom: 2px;
    }
    /* Left empty on purpose: the letter is printed and the client signs on the line. */
    .client-signature-slot {
      width: 46mm;
      height: 24mm;
      border-bottom: 1px solid #c5ccd6;
    }
    .stamp-slot img, .signature-slot img {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
        gap: 0;
        display: block;
        min-height: 0;
      }
      .toolbar { display: none !important; }
      /* The sheet is sized to the paper, never to the screen: a phone lays the print out at its own
         width (~400px), so 100% / 100vh squeezed the A4 text into a narrow column that ran over the
         letterhead footer — the letter printed from a phone came out with huge text. */
      .page {
        box-shadow: none;
        width: 210mm;
        height: 297mm;
      }
    }
  `;
}

export function officialLetterFontsHtml(): string {
  return `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet" />`;
}

export function officialLetterToolbarHtml(title: string): string {
  return `
<div class="toolbar">
  <span>${title}</span>
  <button type="button" class="btn" onclick="window.print()">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <polyline points="6,9 6,2 18,2 18,9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
    طباعة / حفظ PDF
  </button>
</div>`;
}

/**
 * Shrinks the A4 sheet to the screen width on phones; printing is untouched.
 *
 * What it does: the sheet is a fixed 210mm (~794px) box. On a phone it is wider than the screen, and because the
 * page is RTL and centred, the overflow falls off the right edge where the browser cannot scroll to — the inspector
 * saw the right half of «إقرار صحة الموقع» cut away. How: on load and on resize, each `.page` gets a CSS `zoom` of
 * (screen width ÷ sheet width) when it does not fit; nothing changes on wider screens.
 * Edge cases: the print stylesheet forces `zoom: 1`, so a letter printed or saved as PDF from a phone stays a full
 * A4 page; `beforeprint` also clears the zoom for browsers that lay out the print before applying print CSS.
 * Not used by the case-study report, whose pagination script measures the sheets itself.
 */
export function officialLetterFitToScreenHtml(): string {
  return `
<style>
  @media screen and (max-width: 860px) { body { padding: 12px; } }
  @media print { .page { zoom: 1 !important; } }
</style>
<script>
(function () {
  function pages() { return document.querySelectorAll(".page"); }
  function reset() { pages().forEach(function (p) { p.style.zoom = ""; }); }
  function fit() {
    var avail = document.documentElement.clientWidth - 24;
    pages().forEach(function (p) {
      p.style.zoom = "";
      var w = p.offsetWidth;
      if (w > avail && avail > 0) p.style.zoom = String(avail / w);
    });
  }
  fit();
  window.addEventListener("load", fit);
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", reset);
  window.addEventListener("afterprint", fit);
})();
</script>`;
}

export function officialLetterSignBlockHtml(options: {
  stampUrl: string;
  signatureUrl: string;
  /** Adds an empty «توقيع العميل» box between the signature and the stamp, signed by hand after printing. */
  clientSignature?: boolean;
}): string {
  const clientSignature = options.clientSignature
    ? `
      <div class="sign-item">
        <div class="sign-caption">توقيع العميل</div>
        <div class="client-signature-slot"></div>
      </div>`
    : "";
  return `
    <div class="sign-block">
      <div class="sign-item">
        <div class="sign-caption">التوقيع</div>
        <div class="signature-slot">
          <img src="${options.signatureUrl}" alt="التوقيع" />
        </div>
      </div>${clientSignature}
      <div class="sign-item">
        <div class="sign-caption">ختم الشركة</div>
        <div class="stamp-slot">
          <img src="${options.stampUrl}" alt="ختم الشركة" />
        </div>
      </div>
    </div>`;
}
