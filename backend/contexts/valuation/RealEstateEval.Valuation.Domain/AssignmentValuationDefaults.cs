using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Valuation purpose, value basis, and value premise are derived from the work-order primary classification
/// (private → sale / market value / current use; otherwise → liquidation auction / liquidation value / orderly liquidation).
/// </summary>
public static class AssignmentValuationDefaults
{
    public static bool IsPrivatePrimary(AssignmentType type) =>
        type == AssignmentType.PrivateSector;

    public static string PurposeKey(AssignmentType type) =>
        IsPrivatePrimary(type)
            ? ValuationPurposeKeys.Sale
            : ValuationPurposeKeys.AuctionLiquidation;

    public static string PurposeLabelAr(AssignmentType type) =>
        ValuationPurposeKeys.LabelAr(PurposeKey(type));

    public static string BasisOfValueKey(AssignmentType type) =>
        IsPrivatePrimary(type)
            ? BasisOfValueKeys.Market
            : BasisOfValueKeys.Liquidation;

    public static string BasisOfValueLabelAr(AssignmentType type) =>
        BasisOfValueKeys.LabelAr(BasisOfValueKey(type));

    public static string PremiseKey(AssignmentType type) =>
        string.Equals(BasisOfValueKey(type), BasisOfValueKeys.Liquidation, StringComparison.Ordinal)
            ? ValuePremiseKeys.Orderly
            : ValuePremiseKeys.CurrentUse;

    public static string PremiseLabelAr(AssignmentType type) =>
        ValuePremiseKeys.LabelAr(PremiseKey(type));
}
