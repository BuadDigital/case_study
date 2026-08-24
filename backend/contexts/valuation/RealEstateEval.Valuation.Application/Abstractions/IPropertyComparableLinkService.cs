using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPropertyComparableLinkService
{
    Task<PropertyComparableLinkListDto> ListAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<(PropertyComparableLinkListDto? Result, Dictionary<string, string>? Errors)> LinkAsync(
        LinkPropertyComparableRequest request,
        string linkedByUserId,
        CancellationToken cancellationToken = default);

    Task<(PropertyComparableLinkItemDto? Result, Dictionary<string, string>? Errors)> PatchDescriptionAsync(
        Guid propertyId,
        Guid comparablePropertyId,
        PatchPropertyComparableLinkRequest request,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> UnlinkAsync(
        Guid propertyId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default);
}
