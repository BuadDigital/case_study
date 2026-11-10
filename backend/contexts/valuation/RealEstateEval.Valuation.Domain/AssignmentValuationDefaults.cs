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

    /// <summary>
    /// The premise a basis takes when no compatible one is saved: «التصفية المنظمة» for
    /// liquidation, «الاستخدام الحالي» for every other basis (same as <see cref="PremiseKey"/>).
    /// </summary>
    public static string DefaultPremiseForBasis(string? basisKey) =>
        string.Equals(basisKey?.Trim(), BasisOfValueKeys.Liquidation, StringComparison.OrdinalIgnoreCase)
            ? ValuePremiseKeys.Orderly
            : ValuePremiseKeys.CurrentUse;

    /// <summary>
    /// THE basis of value and premise of a valuation — one order for the projection, the save,
    /// the request list and the report (owner's ruling 2026-11-10: the work order owns the basis).
    ///
    /// How it works: basis = the work order's key → the appraiser's saved key (legacy: only when
    /// the work order has none) → the assignment-type default → «market». Premise = the work
    /// order's key → the appraiser's saved key → <see cref="DefaultPremiseForBasis"/>, each taken
    /// only when it is known and fits the resolved basis.
    ///
    /// Edge cases: blank or unknown keys are skipped; keys are trimmed and lower-cased. Fixed
    /// 2026-11-10: the appraiser's saved basis used to win over the work order, so a reconciliation
    /// saved as liquidation 10% printed «قيمة التصفية» 855,000 while the work order said market
    /// value 950,000; a blank premise on liquidation was guessed «قسري» at save but «منظمة» on read.
    /// </summary>
    public static (string BasisKey, string PremiseKey) ResolveBasisAndPremise(
        AssignmentType assignmentType,
        string? workOrderBasisKey,
        string? workOrderPremiseKey,
        string? legacySavedBasisKey = null,
        string? legacySavedPremiseKey = null)
    {
        var basis = FirstKnown(BasisOfValueKeys.IsKnown, workOrderBasisKey, legacySavedBasisKey)
            ?? FirstKnown(BasisOfValueKeys.IsKnown, BasisOfValueKey(assignmentType))
            ?? BasisOfValueKeys.Market;
        var premise = FirstKnown(
                key => ValuePremiseKeys.IsKnown(key) && ValuePremiseKeys.IsCompatible(basis, key),
                workOrderPremiseKey,
                legacySavedPremiseKey)
            ?? DefaultPremiseForBasis(basis);
        return (basis, premise);
    }

    /// <summary>
    /// The valuation purpose the report prints: the work order's key → the assignment-type
    /// default → the approach settings' key (only when the assignment type is unknown).
    /// Edge cases: blank/unknown keys are skipped; null when nothing is known. Fixed 2026-11-10:
    /// the report printed the assignment default even when the work order named a purpose.
    /// </summary>
    public static string? ResolvePurposeKey(
        AssignmentType? assignmentType,
        string? workOrderPurposeKey,
        string? settingsPurposeKey = null) =>
        FirstKnown(ValuationPurposeKeys.IsKnown, workOrderPurposeKey)
        ?? (assignmentType is { } type ? PurposeKey(type) : null)
        ?? FirstKnown(ValuationPurposeKeys.IsKnown, settingsPurposeKey);

    /// <summary>First key that passes <paramref name="accept"/>, trimmed and lower-cased; null when none.</summary>
    private static string? FirstKnown(Func<string, bool> accept, params string?[] keys)
    {
        foreach (var key in keys)
        {
            var normalized = key?.Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(normalized) && accept(normalized)) return normalized;
        }
        return null;
    }
}
