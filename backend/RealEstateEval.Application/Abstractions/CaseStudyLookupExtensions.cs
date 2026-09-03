namespace RealEstateEval.Application.Abstractions;

/// <summary>Helpers over case-study reads — previously duplicated in both finance inspector-fee services.</summary>
public static class CaseStudyLookupExtensions
{
 /// <summary>Property IDs with completed case study among the requested IDs only.</summary>
    public static async Task<HashSet<Guid>> GetCompletedCaseStudyPropertyIdsAsync(
        this ICaseStudyLookup lookup,
        IEnumerable<Guid?> propertyIds,
        CancellationToken cancellationToken)
    {
        var ids = propertyIds
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0) return [];

        var ready = await lookup.ListCompletedCaseStudyPropertyIdsAsync(cancellationToken);
        return ready.Where(ids.Contains).ToHashSet();
    }
}
