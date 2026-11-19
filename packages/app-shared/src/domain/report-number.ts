/**
 * The report number printed on a report: a later version keeps the number and adds «/n»
 * (PRV-26-00123/2, PRC-26-00123/2). Shared by the valuation report and the case-study report.
 *
 * How it works: trims `reportNo`; when it is set and `version` is above 1 returns
 * `${number}/${version}`, else the number as is.
 *
 * Edge cases: version 1 or unknown → the bare number; no number yet → "" (never "/2").
 * The suffix changed from « نسخة n» to «/n» with the PRV- numbering. A number that already carries
 * its suffix (the package's, stamped by the server since 2026-11-18) is kept as is — never «/2/2».
 */
export function versionedReportNo(
  reportNo: string | null | undefined,
  version: number | null | undefined,
): string {
  const base = (reportNo ?? "").trim();
  if (!base || version == null || version <= 1 || base.endsWith(`/${version}`)) return base;
  return `${base}/${version}`;
}
