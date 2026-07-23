namespace RealEstateEval.Application.Rules;

/// <summary>
/// Government-review party-task fees (legacy workflow) and ops court-visit pricing:
/// classification is always «متعاون فرد».
/// Seed/fallback only — live defaults come from the active <c>PartyFeePricingTable.GovernmentReviewFeeSar</c>
/// (أتعاب الزيارة). Key-receipt uses <c>KeyReceiptFeeSar</c> separately.
/// Legacy <c>government-review</c> workflow tasks still create <c>InspectorFeeLedger</c> rows for CDO testing;
/// the new ops path stamps <c>CourtVisitFeeCharge</c> on court_visit complete instead.
/// </summary>
public static class GovernmentReviewFeeRules
{
    public const string PartyType = InspectorFeeRules.TypeCooperatorIndividual;

    /// <summary>Seed fallback when pricing config row is first created.</summary>
    public const decimal FallbackFeeSar = 350m;
}
