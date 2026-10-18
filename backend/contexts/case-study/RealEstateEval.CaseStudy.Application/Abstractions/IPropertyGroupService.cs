using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>grouped-property linking: suggest → human confirm → link/unlink.</summary>
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

    /// <summary>
    /// Records the names of documents the screen copied onto a deed of a group — empty name
    /// slots only. Error when the property is missing.
    /// </summary>
    Task<(FillPropertyGroupDocumentNamesResultDto? Result, string? Error)> FillDocumentNamesAsync(
        Guid propertyId,
        FillPropertyGroupDocumentNamesRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
