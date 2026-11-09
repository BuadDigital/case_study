namespace RealEstateEval.Domain;

/// <summary>
/// Numbering Workshop + the decisions of 2026-10-19/20 and 2026-11-08: uniform pattern
/// {prefix}-{YY}-{sequence 5}, yearly sequence, Latin only — never an Arabic prefix. Every deed
/// («المعاملة») gets its official PR number at the first full save of its initial data; a linked
/// property («العقار المرتبط») carries its root deed's number plus <see cref="LinkedSuffix"/>; the two
/// report numbers are derived from the property number (PRC / PRV) so anyone reading one number knows
/// the others. The temporary TMP number is retired (old rows keep it as history). This class is the
/// only seam of the formula; the counters keep the full year, only the printed form is shortened.
/// </summary>
public static class ReferenceNumbering
{
    /// <summary>
    /// The retired temporary number (TMP-{YY}-{seq}, 2026-10-20 → 2026-11-08). Nothing draws it any more;
    /// rows from that period keep it as their history.
    /// </summary>
    public const string TransactionDraft = "TMP";

    /// <summary>A deed's official number (رقم المعاملة) — drawn at the first full save of its initial data.</summary>
    public const string Property = "PR";

    /// <summary>The fixed suffix of a linked property's number: PR-26-00123-L (no deed count, no kind letter).</summary>
    public const string LinkedSuffix = "-L";

    /// <summary>A comparable property in the valuation bank: CMP-{YY}-{seq}.</summary>
    public const string Comparable = "CMP";

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

    /// <summary>Two-digit year for the printed form: 2026 → 26.</summary>
    public static string ShortYear(int year) => (year % 100).ToString("D2");

    /// <summary>The printed number for a prefix, year and yearly sequence: PR-26-00123.</summary>
    /// <remarks>
    /// How it works: joins the prefix, <see cref="ShortYear"/> of the year and the sequence padded to five
    /// digits with dashes.
    /// Edge cases: the year was printed with four digits (PR-2026-00123); only the
    /// printed form is shortened — callers pass the full year and the counters stay keyed by it, so the
    /// yearly sequence is unchanged.
    /// </remarks>
    public static string Format(string prefix, int year, int sequence) =>
        $"{prefix}-{ShortYear(year)}-{sequence:D5}";

    /// <summary>
    /// A document number derived from the transaction reference: the same year and sequence
    /// under the document prefix (PR-26-00123 → PRC-26-00123). Null when the reference is
    /// not an official PR number.
    /// </summary>
    /// <remarks>
    /// How it works: trims the reference; if it starts with "PR-" it swaps the leading "PR" for the
    /// document prefix and keeps the rest as is; otherwise returns null.
    /// Edge cases: a TMP temporary number or null gives null — a report number is never made from a
    /// temporary number. Old four-digit-year roots derive as they are
    /// (PR-2026-00012 → PRV-2026-00012), so already printed numbers stay consistent.
    /// </remarks>
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

    /// <summary>A linked property's number from its root deed's number: PR-26-00123 → PR-26-00123-L.</summary>
    /// <remarks>
    /// How it works: trims the root and appends <see cref="LinkedSuffix"/>.
    /// Edge cases: a root that already ends with the suffix is returned as is, so the suffix never doubles.
    /// </remarks>
    public static string Linked(string root)
    {
        var trimmed = (root ?? "").Trim();
        return IsLinked(trimmed) ? trimmed : trimmed + LinkedSuffix;
    }

    /// <summary>Whether a number is a linked property's number (ends with <see cref="LinkedSuffix"/>).</summary>
    public static bool IsLinked(string? reference) =>
        (reference ?? "").Trim().EndsWith(LinkedSuffix, StringComparison.Ordinal);

    /// <summary>The root deed number inside a property number: PR-26-00123-L → PR-26-00123; a single deed's number as is.</summary>
    /// <remarks>Edge cases: blank → null.</remarks>
    public static string? RootOf(string? reference)
    {
        var trimmed = (reference ?? "").Trim();
        if (trimmed.Length == 0) return null;
        return IsLinked(trimmed) ? trimmed[..^LinkedSuffix.Length] : trimmed;
    }

    /// <summary>
    /// Orders numbers of one prefix by year, then sequence — the smallest is the root of a linked property.
    /// </summary>
    /// <remarks>
    /// How it works: splits {prefix}-{year}-{sequence}; a two-digit year counts as 20YY so the old
    /// four-digit form (PR-2026-00012) and the short one (PR-26-00012) sort together; then compares the
    /// sequence numerically. Edge cases: a number that does not parse sorts after every parsed one and
    /// falls back to ordinal text order, so the result is stable and never throws.
    /// </remarks>
    public static readonly IComparer<string> Order = Comparer<string>.Create(CompareNumbers);

    private static int CompareNumbers(string? a, string? b)
    {
        var pa = Parse(a);
        var pb = Parse(b);
        if (pa is not null && pb is not null)
        {
            var byYear = pa.Value.Year.CompareTo(pb.Value.Year);
            return byYear != 0 ? byYear : pa.Value.Sequence.CompareTo(pb.Value.Sequence);
        }
        if (pa is not null) return -1;
        if (pb is not null) return 1;
        return string.CompareOrdinal(a, b);
    }

    private static (int Year, int Sequence)? Parse(string? number)
    {
        var parts = (RootOf(number) ?? "").Split('-');
        if (parts.Length != 3) return null;
        if (!int.TryParse(parts[1], out var year) || !int.TryParse(parts[2], out var sequence)) return null;
        return (year < 100 ? 2000 + year : year, sequence);
    }
}
