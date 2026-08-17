using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IComparablePropertyService
{
    Task<IReadOnlyList<ComparablePropertyDto>> ListAsync(
        ComparablePropertyListQuery query,
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

 /// <summary>Rank active bank comps by distance to subject (field inspection or query coords).</summary>
    Task<ComparableProximitySuggestionListDto> SuggestByProximityAsync(
        ComparableProximityQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>ق-3: وضع/تحديث وسوم الجودة البشرية (موثوقية/مكرر) بمبرر — السجل يبقى.</summary>
    Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> SetQualityTagsAsync(
        Guid id,
        SaveComparableQualityTagsRequest request,
        string taggedByUserId,
        CancellationToken cancellationToken = default);
}
