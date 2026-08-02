using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFieldSyncStatusService
{
    Task UpsertAsync(
        string userId,
        UpsertFieldSyncStatusRequest request,
        CancellationToken cancellationToken = default);

    Task ClearAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>Rows with pending work older than two hours (spec §6.3).</summary>
    Task<IReadOnlyList<FieldSyncStatusDto>> ListStaleAsync(
        CancellationToken cancellationToken = default);
}
