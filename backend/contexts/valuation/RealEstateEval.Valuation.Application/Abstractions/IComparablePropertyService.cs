using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IComparablePropertyService
{
    Task<IReadOnlyList<ComparablePropertyDto>> ListAsync(
        ComparablePropertyListQuery query,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted page. See docs/architecture/pagination-contract.md §4.</summary>
    Task<PagedResultDto<ComparablePropertyDto>> ListPagedAsync(
        ComparablePropertyListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<ComparablePropertyDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertComparablePropertyRequest request,
        string enteredByUserId,
        CancellationToken cancellationToken = default);

    Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertComparablePropertyRequest request,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, string? Error)> ReactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

 /// <summary>Rank active bank comps by distance to subject (field inspection or query coords).</summary>
    Task<ComparableProximitySuggestionListDto> SuggestByProximityAsync(
        ComparableProximityQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>Q-3: set/update human quality tags (reliability/duplicate) with rationale — record remains.</summary>
    Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> SetQualityTagsAsync(
        Guid id,
        SaveComparableQualityTagsRequest request,
        string taggedByUserId,
        CancellationToken cancellationToken = default);
}
