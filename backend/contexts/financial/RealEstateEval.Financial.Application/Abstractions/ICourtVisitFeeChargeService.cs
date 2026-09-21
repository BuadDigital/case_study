using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Court-visit fee charges. Financial host uses EF; Case Study calls HTTP.
/// </summary>
public interface ICourtVisitFeeChargeService
{
    Task<bool> ExistsForTaskAsync(
        Guid operationsTaskId,
        CancellationToken cancellationToken = default);

    Task AddChargeAsync(
        CreateCourtVisitFeeChargeRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, decimal?>> GetAmountsByTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> ListChargedTaskIdsAsync(
        CancellationToken cancellationToken = default);
}
