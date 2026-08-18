using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPropertyKeyGateResolver
{
    Task<PropertyKeyGateDto> ResolveAsync(
        Guid? propertyId,
        string? poNumber,
        string? deedNumber,
        string? requestNumber,
        CancellationToken cancellationToken = default);
}
