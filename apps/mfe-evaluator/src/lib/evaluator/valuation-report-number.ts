// Decision 2026-10-19: the report number (PRV-{YY}-{seq}) is never computed in the browser. It
// derives from the transaction's official PR reference, confirmed by the server at the first
// report approval, and reaches the screens as `reportNo` on the appraisal package and as
// `reportNumber` on the report draft. Only the issue-date helper remains here.

import { localDateIso } from "@platform/app-shared/format/date";

/** Local calendar date — the report's own date (UTC slipped a day after midnight). */
export function formatValuationReportIssueDateIso(issuedAt: Date = new Date()): string {
  return localDateIso(issuedAt);
}

/** What the screens show where the number will be, before the server fixed it. */
export const REPORT_NUMBER_PENDING_AR = "يُثبَّت عند الاعتماد";
