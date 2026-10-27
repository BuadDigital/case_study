// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • R2-20  New file — splitComparableCodes cuts alert text into plain runs and CMP-… code runs, so the
//           UI can keep each code on one line. Pure.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Comparable codes («CMP-8E3B9A1F», «CMP-2026-000123») inside alert text. A phone broke them at the
 * hyphen («CMP-» on one line, «77E7E900» on the next); the text is cut into plain runs and codes so
 * each code can be kept on one line. Pure.
 */
const COMPARABLE_CODE = /(CMP-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/g;

export type TextRun = { text: string; code: boolean };

export function splitComparableCodes(text: string): TextRun[] {
  return text
    .split(COMPARABLE_CODE)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, code: /^CMP-/.test(part) }));
}
