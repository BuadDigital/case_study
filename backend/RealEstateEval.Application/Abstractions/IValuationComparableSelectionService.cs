using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationComparableSelectionService
{
    Task<ValuationComparableSelectionListDto?> ListAsync(
        Guid valuationRequestId,
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
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> RemoveAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default);

    Task<(ValuationComparableSelectionDto? Result, Dictionary<string, string>? Errors)> SaveMarketAsync(
        Guid valuationRequestId,
        Guid selectionId,
        SaveValuationComparableMarketRequest request,
        CancellationToken cancellationToken = default);

    Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)> SaveMarketApproachAsync(
        Guid valuationRequestId,
        SaveValuationMarketApproachRequest request,
        CancellationToken cancellationToken = default);
}
