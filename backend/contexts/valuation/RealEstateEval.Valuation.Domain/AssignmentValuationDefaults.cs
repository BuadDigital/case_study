namespace RealEstateEval.Domain;

/// <summary>
/// الغرض من التقييم وأساس القيمة يُشتقّان من التصنيف الأساسي لأمر العمل
/// (خاص → بيع / قيمة سوقية، وإلا → مزاد تصفية / قيمة تصفية).
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
}
