namespace RealEstateEval.Domain;

/// <summary>
/// Numbering Workshop (Decision 22 + bit lines 1–5): Uniform pattern {prefix}-{year}-{sequence 5}
/// In annual sequence and Latin numbers. This function is the only “seam” of the formula — any modification
/// Later in the workshop only changes here. Numbers issued before activation never change.
/// </summary>
public static class ReferenceNumbering
{
 // Eight entity prefixes (bit clause 2) + external reference to Valuation Report (bit clause 3).
    public const string Property = "PR";
    public const string Transaction = "TX";
    public const string User = "US";
    public const string Vendor = "VN";
    public const string Letter = "LT";
    public const string CaseStudyReport = "CS";
    public const string DisbursementStatement = "DS";
    public const string KeyEnvelope = "KE";
    public const string ValuationReport = "TQ";

    public const int MaxYearlySequence = 99_999;

 /// <summary>Gregorian year, Riyadh time — year boundaries follow the local business calendar.</summary>
    public static int RiyadhYear(DateTime utcNow) => utcNow.AddHours(3).Year;

    public static string Format(string prefix, int year, int sequence) =>
        $"{prefix}-{year:D4}-{sequence:D5}";
}
