namespace RealEstateEval.Application.Rules;

/// <summary>
/// Government-review party-task fees (legacy workflow) and ops court-visit pricing:
/// classification is always «متعاون فرد».
/// The visit fee comes only from the active <c>PartyFeePricingTable.GovernmentReviewFeeSar</c>
/// (أتعاب الزيارة); key-receipt uses <c>KeyReceiptFeeSar</c> separately. Neither has a fallback —
/// an unpriced table must stop the charge rather than default to one.
/// Legacy <c>government-review</c> workflow tasks still create <c>InspectorFeeLedger</c> rows for CDO testing;
/// the new ops path stamps <c>CourtVisitFeeCharge</c> on court_visit complete instead.
/// </summary>
public static class GovernmentReviewFeeRules
{
    public const string PartyType = InspectorFeeRules.TypeCooperatorIndividual;
}
