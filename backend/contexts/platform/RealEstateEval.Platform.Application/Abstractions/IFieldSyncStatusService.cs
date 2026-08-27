using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface IFieldSyncStatusService
{
    Task UpsertAsync(
        string userId,
        UpsertFieldSyncStatusRequest request,
        CancellationToken cancellationToken = default);

    Task ClearAsync(string userId, CancellationToken cancellationToken = default);

 /// <summary>Rows with pending work older than two hours (spec ).</summary>
    Task<IReadOnlyList<FieldSyncStatusDto>> ListStaleAsync(
        CancellationToken cancellationToken = default);
}
