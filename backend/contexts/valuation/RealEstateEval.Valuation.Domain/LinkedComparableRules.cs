namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Where a land comparable entered inside a built property's transaction goes. What is being valued
/// decides, not the registered type: a villa valued as «أرض فقط» compares land with land in the market table.
/// </summary>
public static class LinkedComparableRules
{
    /// <summary>
    /// The land table is on screen only with the cost approach on and a scope that values land.
    /// Before the settings are saved both arguments are null, which reads as the defaults: cost on,
    /// land and buildings.
    /// </summary>
    public static bool LandTableIsShown(bool? costApproachEnabled, string? costScopeKey) =>
        costApproachEnabled != false
        && !CostScopeKeys.IsLandOnly(costScopeKey)
        && !CostScopeKeys.IsBuildingOnly(costScopeKey);

    /// <summary>
    /// A land comparable sent to the market table of a built subject counts at once only under «أرض فقط».
    /// Under any other scope that table compares whole buildings, so the row shows unadopted: a land price
    /// must not enter the value without the appraiser choosing it.
    /// </summary>
    public static bool AdoptLandInMarket(string? costScopeKey) => CostScopeKeys.IsLandOnly(costScopeKey);
}
