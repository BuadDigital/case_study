using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationComparableSelectionService
{
    Task<ValuationComparableSelectionListDto?> ListAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// List selections for one comps table context (market | land_within_cost).
    /// </summary>
    Task<ValuationComparableSelectionListDto?> ListAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken = default);

    Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)> ReplaceAsync(
        Guid valuationRequestId,
        ReplaceValuationComparableSelectionsRequest request,
        string selectedByUserId,
        CancellationToken cancellationToken = default);

    Task<(ValuationComparableSelectionDto? Result, string? Error)> SetAdoptedAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        bool isAdopted,
        string selectedByUserId,
        CancellationToken cancellationToken = default,
        string? selectionContext = null);

    Task<(bool Ok, string? Error)> RemoveAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default,
        string? selectionContext = null);

    Task<(ValuationComparableSelectionDto? Result, Dictionary<string, string>? Errors)> SaveMarketAsync(
        Guid valuationRequestId,
        Guid selectionId,
        SaveValuationComparableMarketRequest request,
        CancellationToken cancellationToken = default);

    Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)> SaveMarketApproachAsync(
        Guid valuationRequestId,
        SaveValuationMarketApproachRequest request,
        CancellationToken cancellationToken = default);

 /// <summary>ق-8-1: مبرر عامل التسوية الواحد (فارغ = مسح؛ الحد الأدنى ق-8-2).</summary>
    Task<(ValuationAdjustmentFactorRationaleDto? Result, Dictionary<string, string>? Errors)>
        SaveFactorRationaleAsync(
            Guid valuationRequestId,
            SaveAdjustmentFactorRationaleRequest request,
            string? updatedByUserId,
            CancellationToken cancellationToken = default);
}
