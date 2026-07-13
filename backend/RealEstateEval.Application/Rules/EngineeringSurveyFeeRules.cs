namespace RealEstateEval.Application.Rules;

/// <summary>
/// Engineering-survey fees: offices are always external counterparties.
/// Seed/fallback only — live defaults come from <c>PartyFeePricingConfig</c>.
/// </summary>
public static class EngineeringSurveyFeeRules
{
    public const string OfficePartyType = InspectorFeeRules.TypeCooperatorOrganization;

    /// <summary>Seed fallback when pricing config row is first created.</summary>
    public const decimal FallbackFeeSar = 500m;

    public static string ResolveOfficeType(string? assigneeId) => OfficePartyType;

    public static decimal DefaultAgreedFee(string? officeType = null) => FallbackFeeSar;

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        InspectorFeeRules.NetFee(agreedFeeSar, supervisorDiscountSar);
}
