import {
  BRAND_IDENTITY_DEFAULTS,
  type OrganizationBrandingSettings,
} from "@platform/api-client";

const A4_HEIGHT_MM = 297;
const DEFAULT_LETTERHEAD_PATH = "/case-study/ejadah-letterhead.png";

function mm(value: number | null | undefined, fallback: number): number {
  return value && value > 0 ? value : fallback;
}

/** Margins for the four-slice letterhead (الهوية البصرية). */
export function orgLetterheadLayout(
  branding: Pick<
    OrganizationBrandingSettings,
    | "letterheadHeadMm"
    | "letterheadFootTopMm"
    | "letterheadPadMm"
    | "letterheadPadStartMm"
  > | null
  | undefined,
) {
  const d = BRAND_IDENTITY_DEFAULTS;
  const headMm = mm(branding?.letterheadHeadMm, d.letterheadHeadMm!);
  const footTop = mm(branding?.letterheadFootTopMm, d.letterheadFootTopMm!);
  const footMm = Math.max(0, A4_HEIGHT_MM - footTop);
  const startMm = mm(branding?.letterheadPadStartMm, d.letterheadPadStartMm!);
  const endMm = mm(branding?.letterheadPadMm, d.letterheadPadMm!);
  return { headMm, footMm, startMm, endMm };
}

export function orgLetterheadUrl(
  branding: Pick<OrganizationBrandingSettings, "letterheadUrl"> | null | undefined,
): string {
  return branding?.letterheadUrl?.trim() || DEFAULT_LETTERHEAD_PATH;
}

/**
 * CSS for the four letterhead strips — same geometry as valuation report /
 * الهوية البصرية preview. `bgUrl` must already be HTML-escaped.
 */
export function orgLetterheadSliceCss(
  bgUrl: string,
  layout: ReturnType<typeof orgLetterheadLayout>,
): string {
  const { headMm, footMm, startMm, endMm } = layout;
  return `
    .lh-slice {
      position: absolute;
      pointer-events: none;
      background-image: url("${bgUrl}");
      background-size: 210mm 297mm;
      background-repeat: no-repeat;
      z-index: 0;
    }
    .lh-head {
      top: 0; left: 0; right: 0;
      height: ${headMm}mm;
      background-position: top center;
    }
    .lh-foot {
      bottom: 0; left: 0; right: 0;
      height: ${footMm}mm;
      background-position: bottom center;
    }
    .lh-start {
      top: ${headMm}mm; bottom: ${footMm}mm; right: 0;
      width: ${startMm}mm;
      background-position: top right;
    }
    .lh-end {
      top: ${headMm}mm; bottom: ${footMm}mm; left: 0;
      width: ${endMm}mm;
      background-position: top left;
    }
  `;
}

/** Content box inset to the white area between the four strips. */
export function orgLetterheadContentCss(
  layout: ReturnType<typeof orgLetterheadLayout>,
  extra = "",
): string {
  const { headMm, footMm, startMm, endMm } = layout;
  return `
    .content {
      position: absolute;
      z-index: 1;
      top: ${headMm}mm;
      bottom: ${footMm}mm;
      right: ${startMm}mm;
      left: ${endMm}mm;
      padding: 5mm 4mm;
      overflow: hidden;
      background: #fff;
      ${extra}
    }
  `;
}

export const ORG_LETTERHEAD_SLICES_HTML = `
    <div class="lh-slice lh-head"></div>
    <div class="lh-slice lh-foot"></div>
    <div class="lh-slice lh-start"></div>
    <div class="lh-slice lh-end"></div>
`;
