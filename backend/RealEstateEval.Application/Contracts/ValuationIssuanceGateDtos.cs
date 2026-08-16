namespace RealEstateEval.Application.Contracts;

public class ValuationIssuanceGateItemDto
{
    public required string Code { get; init; }
    public required string LabelAr { get; init; }
    public bool Passed { get; init; }
    public bool IsHard { get; init; }
    public bool IsWarning { get; init; }
    public string? DetailAr { get; init; }
}

public class ValuationMethodologyAlertItemDto
{
    public int Number { get; init; }
    public required string Code { get; init; }
    public required string LabelAr { get; init; }
    public bool Triggered { get; init; }
    /// <summary>True when severity is hard (Solomon: 3/4/5/11/15/16).</summary>
    public bool IsHard { get; init; }
    /// <summary>hard | require_rationale | require_ack</summary>
    public string SeverityKind { get; init; } = "require_ack";
    public bool Evaluated { get; init; }
    public bool BlocksIssuance { get; init; }
    public string? DetailAr { get; init; }
    public string? OverrideRationale { get; init; }
    public bool Acknowledged { get; init; }
}

public class ValuationIssuanceGatesDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public bool AllowsIssuance { get; init; }
    public IReadOnlyList<ValuationIssuanceGateItemDto> Gates { get; init; } = [];
    public IReadOnlyList<string> BlockingReasonsAr { get; init; } = [];
    /// <summary>§ح methodology alerts — Solomon 2026-08-16 three-tier.</summary>
    public IReadOnlyList<ValuationMethodologyAlertItemDto> MethodologyAlerts { get; init; } = [];
    public int MethodologyAlertTriggeredCount { get; init; }
    public string MethodologyAlertsNoteAr { get; init; } =
        "تنبيهات منهجية (§ح): 6 حاجبة · 6 بمبرر نصي · 5 بإقرار (سليمان 2026-08-16).";
}
