using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationListsService
{
    Task<ValuationListsDto> GetAsync(CancellationToken cancellationToken = default);

    Task<ValuationListsDto> SaveAsync(
        SaveValuationListsRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts a usage written on an inspection. A name the list does not have joins it as pending,
    /// usable at once and queued for review.
    /// </summary>
    Task RecordPropertyUsageAsync(
        string nameAr,
        string actorId,
        CancellationToken cancellationToken = default);

    /// <summary>Approves a usage name, or corrects and approves it. Works on an approved name too.</summary>
    /// <exception cref="InvalidOperationException">Unknown row, unknown action, or a name already listed.</exception>
    Task<ValuationListsDto> ReviewPropertyUsageAsync(
        string key,
        ReviewPropertyUsageRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
