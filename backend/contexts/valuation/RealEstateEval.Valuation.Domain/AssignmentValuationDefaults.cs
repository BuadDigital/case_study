using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// الغرض من التقييم وأساس القيمة وفرضية القيمة تُشتق من التصنيف الأساسي لأمر العمل
/// (خاص → بيع / قيمة سوقية / استخدام حالي، وإلا → مزاد تصفية / قيمة تصفية / تصفية منظمة).
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
