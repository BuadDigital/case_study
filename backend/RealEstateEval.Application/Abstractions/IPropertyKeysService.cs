using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPropertyKeysService
{
    Task<IReadOnlyList<PropertyKeyRecordDto>> ListAsync(
        bool? hasKey,
        CancellationToken cancellationToken = default);

    Task<PropertyKeyRecordDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PropertyKeyRecordDto?> PatchAsync(
        Guid id,
        UpdatePropertyKeyRequest request,
        CancellationToken cancellationToken = default);
}
