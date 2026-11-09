// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alerts The alerts note now counts the new alerts: «تنبيهات منهجية (24): 7 حاجبة · 12 بمبرر نصي إلزامي
//           · 5 بإقرار.» (was 20: 7 / 8 / 5).
// ──────────────────────────────────────────────────────────────────────────────────────────────

namespace RealEstateEval.Valuation.Application.Contracts;

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
 /// <summary>True when severity is hard (alerts 3/4/5/11/15/16).</summary>
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
 /// <summary>Methodology alerts — three-tier.</summary>
    public IReadOnlyList<ValuationMethodologyAlertItemDto> MethodologyAlerts { get; init; } = [];
    public int MethodologyAlertTriggeredCount { get; init; }
    public string MethodologyAlertsNoteAr { get; init; } =
        "تنبيهات منهجية (24): 7 حاجبة · 12 بمبرر نصي إلزامي · 5 بإقرار.";

    /// <summary>
    /// Review approved the study (Omar 2026-11-08) — read from Case Study; null when unknown. Not a gate:
    /// it holds only the draft's send to the appraiser, never the issuance of an older transaction.
    /// </summary>
    public bool? StudyApprovedByReview { get; init; }

    /// <summary>Review accepted the appraiser's value (his package's acceptance) — as above.</summary>
    public bool? ValueAcceptedByReview { get; init; }
}
