namespace RealEstateEval.Application.Rules;

/// <summary>
/// Government-review: classification is always «متعاون فرد».
/// Seed/fallback only — live defaults come from <c>PartyFeePricingConfig</c>.
/// </summary>
public static class GovernmentReviewFeeRules
{
    public const string PartyType = InspectorFeeRules.TypeCooperatorIndividual;

    /// <summary>Seed fallback when pricing config row is first created.</summary>
    public const decimal FallbackFeeSar = 350m;

    public static string ResolvePartyType(string? assigneeId = null) => PartyType;

    public static decimal DefaultAgreedFee(string? partyType = null) => FallbackFeeSar;
}
