using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>Decision 20 — grouped-property linking: suggest → human confirm → link/unlink.</summary>
public interface IPropertyGroupService
{
    Task<PropertyGroupDto?> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PropertyGroupSuggestionDto>> SuggestAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    Task<(PropertyGroupDto? Result, string? Error)> ConfirmLinkAsync(
        Guid propertyId,
        Guid targetPropertyId,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(PropertyGroupDto? Result, string? Error)> UnlinkAsync(
        Guid propertyId,
        string reason,
        string actorId,
        CancellationToken cancellationToken = default);
}
