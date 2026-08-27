using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

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
