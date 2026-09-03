using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

public interface IPropertyKeysService
{
    Task<IReadOnlyList<PropertyKeyRecordDto>> ListAsync(
        bool? hasKey,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Projects key records from envelopes + legacy sources. Runs from the
 /// maintenance loop — reads must not pay for the full projection per request.
 /// </summary>
    Task SyncProjectionAsync(CancellationToken cancellationToken = default);

    Task<PropertyKeyRecordDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PropertyKeyRecordDto?> PatchAsync(
        Guid id,
        UpdatePropertyKeyRequest request,
        CancellationToken cancellationToken = default);
}
