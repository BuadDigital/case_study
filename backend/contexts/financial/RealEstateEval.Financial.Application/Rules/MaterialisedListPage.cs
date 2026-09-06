using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Cuts a page out of a list that was synthesised in memory. Used by the billing lists whose rows
/// are composed from cross-context reads rather than queried (ready lines, Enfaz readiness and
/// tracking): the count is taken over the same materialised list the page comes from, so the
/// envelope's <c>totalCount</c> and its <c>items</c> always agree. Pure — no I/O.
/// </summary>
public static class MaterialisedListPage
{
    public static PagedResultDto<T> Cut<T>(IReadOnlyList<T> rows, int skip, int take, int page)
    {
        var safeSkip = Math.Max(0, skip);
        var safeTake = Math.Max(0, take);
        var items = rows.Skip(safeSkip).Take(safeTake).ToList();

        return new PagedResultDto<T>
        {
            Items = items,
            TotalCount = rows.Count,
            Page = Math.Max(1, page),
            PageSize = safeTake,
        };
    }
}
