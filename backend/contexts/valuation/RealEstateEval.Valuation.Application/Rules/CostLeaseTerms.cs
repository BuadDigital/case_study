using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// D11 (cost side): buildings held under a usufruct or on leased land («حق منفعة / أرض مستأجرة»)
/// have their remaining economic life capped at the remaining lease / usufruct years — whatever the
/// valuation scope (round 2: the cap used to apply to «مباني فقط» only, so a «أرض مع المباني» valuation
/// on a 2-year usufruct was depreciated over the full 40-year life). The ownership type and lease
/// years live in the approach settings; this class is the one place the cost approach reads them.
/// </summary>
public static class CostLeaseTerms
{
    /// <summary>
    /// Remaining lease years that cap the economic life for this valuation, or null when the cap
    /// does not apply (freehold, or no lease term entered).
    /// </summary>
    public static decimal? RemainingLeaseYears(ValuationApproachSettings? settings) =>
        settings is null
            ? null
            : ForInterest(
                OwnershipInterestKeys.IsLeasehold(settings.OwnershipInterestKey),
                settings.RemainingLeaseYears);

    /// <summary>
    /// The cap applies to a leasehold interest (usufruct or leased land,
    /// <see cref="OwnershipInterestKeys.IsLeasehold"/>) with a lease term entered.
    /// </summary>
    public static decimal? ForInterest(bool isLeasehold, decimal? remainingLeaseYears) =>
        isLeasehold && remainingLeaseYears is >= 0m
            ? remainingLeaseYears
            : null;
}
