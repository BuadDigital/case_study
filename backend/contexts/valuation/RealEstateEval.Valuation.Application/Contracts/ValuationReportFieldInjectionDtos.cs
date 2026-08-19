namespace RealEstateEval.Application.Contracts;

public class ValuationReportFieldDto
{
    public required string FieldKey { get; init; }
    public required string LabelAr { get; init; }
    /// <summary>text | number | date | money | percent | attachment</summary>
    public required string ValueType { get; init; }
    public required string ValueTypeLabelAr { get; init; }
    /// <summary>platform | computed | deferred | asset | conditional_empty</summary>
    public required string SourceKind { get; init; }
    public string? Value { get; init; }
    public bool Filled { get; init; }
    public string? Note { get; init; }
}

public class ValuationReportFieldPayloadDto
{
    public Guid ValuationRequestId { get; init; }
    public string DisplayId { get; init; } = "";
    public string PropertyId { get; init; } = "";
    public bool HasStructuresToValue { get; init; }
    public int CatalogCount { get; init; }
    public int ResolvableCount { get; init; }
    public int FilledCount { get; init; }
    public int DeferredCount { get; init; }
    public int AssetCount { get; init; }
    public string PackageNoteAr { get; init; } =
        "طبقة حقول التقرير — تُعرَّف بالمفتاح والتسمية والنوع والمصدر. لا تُطبع كأقسام إضافية. نظام التقييم ملك إجادة؛ الخصم يُطبَّق عند أساس التصفية فقط.";
    public IReadOnlyList<ValuationReportFieldDto> Fields { get; init; } = [];
    /// <summary>No-silent-caps: set when adopted comparables exceed the platform's 3 slots.</summary>
    public string? TruncationNoteAr { get; init; }

    /// <summary>field key → value — filled fields plus conditional-empty fields as "".</summary>
    public IReadOnlyDictionary<string, string> ValuesByFieldKey { get; init; } =
        new Dictionary<string, string>();
}
