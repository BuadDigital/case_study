namespace RealEstateEval.Application.Contracts;

public class ValuationReportFieldDto
{
    public required string Code { get; init; }
    public required string LabelAr { get; init; }
    public required string FieldKey { get; init; }
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
        "طبقة حقول التقرير (أكواد القالب الموروثة) — لا تُطبع كأقسام إضافية. نظام التقييم ملك إجادة؛ الخصم يُطبَّق عند أساس التصفية فقط.";
    public IReadOnlyList<ValuationReportFieldDto> Fields { get; init; } = [];
    /// <summary>No-silent-caps: set when adopted comparables exceed the platform's 3 slots.</summary>
    public string? TruncationNoteAr { get; init; }

    /// <summary>code → value for merge tools — filled codes plus conditional-empty codes as "" (§8 correction 5).</summary>
    public IReadOnlyDictionary<string, string> ValuesByCode { get; init; } =
        new Dictionary<string, string>();
}
