// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • R2-20  New file — renders alert text with each CMP-… comparable code in a nowrap <bdi dir="ltr">, so
//           a phone no longer breaks a code at its hyphen (uses splitComparableCodes).
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { splitComparableCodes } from "./lib/comparable-codes";

/** Alert text whose comparable codes never break across lines (the line may wrap around them). */
export function KeepCodesTogether({ text }: { text: string }) {
  return (
    <>
      {splitComparableCodes(text).map((run, i) =>
        run.code ? (
          <bdi key={i} dir="ltr" className="whitespace-nowrap">
            {run.text}
          </bdi>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}
