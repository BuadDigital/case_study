using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// D11 (cost side): a building valued alone on leased land («حق منفعة / أرض مستأجرة») has its
/// remaining economic life capped at the remaining lease years. The ownership type and lease
/// years live in the approach settings; this class is the one place the cost approach reads them.
/// </summary>
public static class CostLeaseTerms
{
    /// <summary>
    /// Remaining lease years that cap the economic life for this valuation, or null when the cap
    /// does not apply (land included in scope, freehold, or no lease term entered).
    /// </summary>
    public static decimal? RemainingLeaseYears(ValuationApproachSettings? settings, string costScopeKey) =>
        settings is null
            ? null
            : ForScope(
                CostScopeKeys.IsBuildingOnly(costScopeKey),
                OwnershipInterestKeys.IsLeasehold(settings.OwnershipInterestKey),
                settings.RemainingLeaseYears);

    /// <summary>
    /// The cap applies only to a building-only scope on a leasehold interest (usufruct or leased
    /// land, <see cref="OwnershipInterestKeys.IsLeasehold"/>) with a lease term entered.
    /// </summary>
    public static decimal? ForScope(bool buildingOnly, bool isLeasedLand, decimal? remainingLeaseYears) =>
        buildingOnly && isLeasedLand && remainingLeaseYears is >= 0m
            ? remainingLeaseYears
            : null;
}
