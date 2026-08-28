namespace RealEstateEval.Application.Abstractions;

/// <summary>مرافق فوق قراءات دراسة الحالة — كانت منسوخة في خدمتَي أتعاب المعاين بالمالية.</summary>
public static class CaseStudyLookupExtensions
{
 /// <summary>معرّفات العقارات المكتملة دراسةً من بين المعرّفات المطلوبة فقط.</summary>
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
