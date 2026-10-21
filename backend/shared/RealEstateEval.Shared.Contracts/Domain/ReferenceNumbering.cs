namespace RealEstateEval.Domain;

/// <summary>
/// Numbering Workshop (Decision 22) + the transaction decisions of 2026-10-19/20: uniform pattern
/// {prefix}-{YY}-{sequence 5}, yearly sequence, Latin only — never an Arabic prefix. The
/// transaction (the property) is the one root: a temporary TMP number at intake, the official PR
/// number at the first approval of either report, and the two report numbers derived from that
/// root (PRC / PRV) so anyone reading one number knows the others. This class is the only seam of
/// the formula; the counters keep the full year, only the printed form is shortened.
/// </summary>
public static class ReferenceNumbering
{
    /// <summary>Temporary transaction number, given at intake and never printed on a document.</summary>
    public const string TransactionDraft = "TMP";

    /// <summary>The transaction's official reference (the property) — drawn at the first approval.</summary>
    public const string Property = "PR";

    /// <summary>Case-study report: PR root with the C suffix on the prefix.</summary>
    public const string CaseStudyReport = "PRC";

    /// <summary>Valuation report: PR root with the V suffix on the prefix.</summary>
    public const string ValuationReport = "PRV";

    public const string User = "US";
    public const string Vendor = "VN";
    public const string Letter = "LT";
    public const string DisbursementStatement = "DS";
    public const string KeyEnvelope = "KE";

    public const int MaxYearlySequence = 99_999;

    /// <summary>Gregorian year, Riyadh time — year boundaries follow the local business calendar.</summary>
    public static int RiyadhYear(DateTime utcNow) => RiyadhClock.Year(utcNow);

    /// <summary>Two-digit year for the printed form (decision 2026-10-20): 2026 → 26.</summary>
    public static string ShortYear(int year) => (year % 100).ToString("D2");

    public static string Format(string prefix, int year, int sequence) =>
        $"{prefix}-{ShortYear(year)}-{sequence:D5}";

    /// <summary>
    /// A document number derived from the transaction reference: the same year and sequence
    /// under the document prefix (PR-26-00123 → PRC-26-00123). Null when the reference is
    /// not an official PR number.
    /// </summary>
    public static string? Derive(string? transactionReference, string documentPrefix)
    {
        var root = (transactionReference ?? "").Trim();
        if (!root.StartsWith(Property + "-", StringComparison.Ordinal)) return null;
        return documentPrefix + root[Property.Length..];
    }

    public static string? CaseStudyReportNumber(string? transactionReference) =>
        Derive(transactionReference, CaseStudyReport);

    public static string? ValuationReportNumber(string? transactionReference) =>
        Derive(transactionReference, ValuationReport);

    /// <summary>A later version of an approved document: PRV-26-00123/2. Version 1 is the bare number.</summary>
    public static string WithVersion(string number, int version) =>
        version > 1 ? $"{number}/{version}" : number;
}
