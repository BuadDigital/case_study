import { escapeHtml } from "@platform/app-shared/lib/html-escape";
import {
  caseStudySignatureImage,
  caseStudyStampImage,
} from "./case-study-report-data";
import { orgLetterheadUrl } from "./org-letterhead-slices";

/** Blob print windows need absolute asset URLs. */
function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Letterhead, stamp and signature for a printed official letter — absolute and HTML-escaped. */
export function officialLetterAssetUrls(
  branding: Parameters<typeof orgLetterheadUrl>[0],
): { bg: string; stamp: string; signature: string } {
  return {
    bg: escapeHtml(assetUrl(orgLetterheadUrl(branding))),
    stamp: escapeHtml(assetUrl(caseStudyStampImage())),
    signature: escapeHtml(assetUrl(caseStudySignatureImage())),
  };
}
