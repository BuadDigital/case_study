namespace RealEstateEval.Application.Contracts;

/// <summary>
/// The valuation issuance gates as another owner (the Case Study hand-over) reads them from the
/// Valuation API: the subset of its <c>ValuationIssuanceGatesDto</c> a caller decides on.
/// </summary>
public sealed class ValuationIssuanceGatesSnapshotDto
{
    public Guid ValuationRequestId { get; init; }
    public bool AllowsIssuance { get; init; }
    public IReadOnlyList<ValuationIssuanceGateSnapshotItemDto> Gates { get; init; } = [];
    public IReadOnlyList<ValuationMethodologyAlertSnapshotItemDto> MethodologyAlerts { get; init; } = [];
}

public sealed class ValuationIssuanceGateSnapshotItemDto
{
    public string Code { get; init; } = "";
    public string LabelAr { get; init; } = "";
    public bool Passed { get; init; }
    public bool IsHard { get; init; }
    public string? DetailAr { get; init; }
}

public sealed class ValuationMethodologyAlertSnapshotItemDto
{
    public int Number { get; init; }
    public string Code { get; init; } = "";
    public string LabelAr { get; init; } = "";
    public bool BlocksIssuance { get; init; }
    public string? DetailAr { get; init; }
}
