namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// A valuation report issued in an external valuation program (مقياس first) and imported from its
/// periodic Excel export — the map's «تقارير التقييم» layer. One row per (source, report number):
/// a later file with the same number replaces the row; a number missing from a later file is never
/// deleted, because each file covers a period only.
/// </summary>
public class ImportedValuationReport
{
    public Guid Id { get; set; }
    /// <summary>The program the report came from — see <see cref="ValuationReportSources"/>.</summary>
    public string Source { get; set; } = ValuationReportSources.Meqyas;
    /// <summary>The number as the program prints it, leading zeros kept («000008»).</summary>
    public string ReportNumber { get; set; } = "";
    /// <summary>The same number as an integer — for the gap checks between uploads.</summary>
    public long ReportNumberValue { get; set; }
    public string? Template { get; set; }
    public string? Approver { get; set; }
    public DateOnly? ApprovedAt { get; set; }
    public string? Client { get; set; }
    public string? DeedNumber { get; set; }
    public string PropertyType { get; set; } = "";
    public string? Inspector { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Usage { get; set; } = "";
    public decimal? LandArea { get; set; }
    public decimal? FinalValue { get; set; }
    public string? InspectionAuditor { get; set; }
    public DateOnly? ValuationDate { get; set; }
    /// <summary>The upload that last wrote this row.</summary>
    public Guid ImportBatchId { get; set; }
    public DateTime ImportedAtUtc { get; set; }
}

/// <summary>One upload of a source's export file — the import log and the base of the next gap check.</summary>
public class ValuationReportImportBatch
{
    public Guid Id { get; set; }
    public string Source { get; set; } = ValuationReportSources.Meqyas;
    public string FileName { get; set; } = "";
    public string ImportedByUserId { get; set; } = "";
    public string? ImportedByName { get; set; }
    public DateTime ImportedAtUtc { get; set; }
    public int TotalRows { get; set; }
    public int NewCount { get; set; }
    public int ReplacedCount { get; set; }
    public int RejectedCount { get; set; }
    /// <summary>Highest report number in the file — the next upload of the same source should start after it.</summary>
    public long MaxReportNumberValue { get; set; }
    public string MaxReportNumber { get; set; } = "";
}

/// <summary>External valuation programs the import screen accepts. Add a source with its column template.</summary>
public static class ValuationReportSources
{
    public const string Meqyas = "meqyas";

    public static readonly IReadOnlyDictionary<string, string> LabelsAr = new Dictionary<string, string>
    {
        [Meqyas] = "مقياس",
    };

    public static bool IsKnown(string? source) => source is not null && LabelsAr.ContainsKey(source);

    public static string LabelAr(string source) =>
        LabelsAr.TryGetValue(source, out var label) ? label : source;
}
