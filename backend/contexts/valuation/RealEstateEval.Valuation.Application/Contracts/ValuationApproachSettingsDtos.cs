// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D11  New file — partial settings DTO / save request: the ownership interest (freehold / usufruct /
//         leased_land, «ملكية تامة» / «حق منفعة» / «أرض مستأجرة») and the remaining lease years.
// ──────────────────────────────────────────────────────────────────────────────────────────────

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>D11: the interest being valued and, for a leasehold interest, the remaining lease term.</summary>
public partial class ValuationApproachSettingsDto
{
    /// <summary>freehold (default) | usufruct | leased_land.</summary>
    public string OwnershipInterestKey { get; init; } = "freehold";

    /// <summary>«ملكية تامة» / «حق منفعة» / «أرض مستأجرة».</summary>
    public string OwnershipInterestLabelAr { get; init; } = "";

    /// <summary>Years left on the usufruct / land lease — set for a leasehold interest only.</summary>
    public decimal? RemainingLeaseYears { get; init; }
}

/// <summary>D11: the interest being valued and its remaining lease term.</summary>
public partial class SaveValuationApproachSettingsRequest
{
    /// <summary>freehold (default when blank) | usufruct | leased_land.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(16)]
    public string? OwnershipInterestKey { get; init; }

    /// <summary>Required (&gt; 0, ≤ 999) for usufruct / leased_land; ignored for freehold.</summary>
    public decimal? RemainingLeaseYears { get; init; }
}
