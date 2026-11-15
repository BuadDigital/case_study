using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>The export file of an external valuation program, base64 like every other upload.</summary>
public class ValuationReportImportRequest
{
    [Required, MaxLength(32)]
    public string Source { get; init; } = "";

    [Required, MaxLength(260)]
    public string FileName { get; init; } = "";

    [Required]
    public string ContentBase64 { get; init; } = "";
}

public class ValuationReportSourceDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public int ColumnCount { get; init; }
}

public class ValuationReportRejectedRowDto
{
    public required string ReportNumber { get; init; }
    public string? PropertyType { get; init; }
    public DateOnly? ApprovedAt { get; init; }
    public required string ReasonAr { get; init; }
}

public class ValuationReportNumberGapDto
{
    public required string From { get; init; }
    public required string To { get; init; }
    public long Count { get; init; }
}

public class ValuationReportPreviousGapDto
{
    public required string LastNumber { get; init; }
    public DateTime LastImportedAtUtc { get; init; }
    public required string FirstNumber { get; init; }
    public long MissingCount { get; init; }
}

public class ValuationReportImportPreviewDto
{
    public required string Source { get; init; }
    public required string FileName { get; init; }
    public int TotalRows { get; init; }
    public DateOnly? FirstApprovedAt { get; init; }
    public DateOnly? LastApprovedAt { get; init; }
    public int MatchedColumns { get; init; }
    public int RequiredColumns { get; init; }
    public IReadOnlyList<string> MissingColumns { get; init; } = [];
    public int NewCount { get; init; }
    public int ReplacedCount { get; init; }
    public int RejectedCount { get; init; }
    public int NoValueCount { get; init; }
    public IReadOnlyList<ValuationReportRejectedRowDto> Rejected { get; init; } = [];
    public bool HasPreviousBatch { get; init; }
    public ValuationReportPreviousGapDto? PreviousBatchGap { get; init; }
    public long InternalMissingCount { get; init; }
    public int InternalGapCount { get; init; }
    public IReadOnlyList<ValuationReportNumberGapDto> LargestInternalGaps { get; init; } = [];
}

public class ValuationReportImportBatchDto
{
    public Guid Id { get; init; }
    public required string Source { get; init; }
    public required string SourceLabelAr { get; init; }
    public required string FileName { get; init; }
    public string? ImportedByName { get; init; }
    public DateTime ImportedAtUtc { get; init; }
    public int NewCount { get; init; }
    public int ReplacedCount { get; init; }
    public int RejectedCount { get; init; }
}

/// <summary>One map point — kept small: the layer can hold hundreds of thousands.</summary>
public class ValuationReportMapPointDto
{
    public required string Source { get; init; }
    public required string ReportNumber { get; init; }
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public required string PropertyType { get; init; }
    public required string Usage { get; init; }
    public DateOnly? ValuationDate { get; init; }
}

public class ValuationReportDetailDto
{
    public required string Source { get; init; }
    public required string SourceLabelAr { get; init; }
    public required string ReportNumber { get; init; }
    public string? Template { get; init; }
    public string? Approver { get; init; }
    public DateOnly? ApprovedAt { get; init; }
    public string? Client { get; init; }
    public string? DeedNumber { get; init; }
    public required string PropertyType { get; init; }
    public string? Inspector { get; init; }
    public required string Usage { get; init; }
    public decimal? LandArea { get; init; }
    public decimal? FinalValue { get; init; }
    public string? InspectionAuditor { get; init; }
    public DateOnly? ValuationDate { get; init; }
}
