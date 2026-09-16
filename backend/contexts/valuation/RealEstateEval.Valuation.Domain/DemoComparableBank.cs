namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Fixed ids of the interactive-model demo bank (TRX-24-0912, OFR-25-0206, …).
/// Production valuations must not auto-attach or auto-adopt these — the valuer picks.
/// </summary>
public static class DemoComparableBank
{
    public static readonly Guid[] Ids =
    [
        Guid.Parse("c0a10001-0000-4000-8000-000000000001"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000002"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000003"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000004"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000005"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000006"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000007"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000008"),
        Guid.Parse("c0a10001-0000-4000-8000-000000000009"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000a"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000b"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000c"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000d"),
        Guid.Parse("c0a10001-0000-4000-8000-00000000000e"),
    ];

    static readonly HashSet<Guid> IdSet = [..Ids];

    public static bool Contains(Guid comparablePropertyId) =>
        IdSet.Contains(comparablePropertyId);

    public static IReadOnlyList<Guid> Exclude(IEnumerable<Guid> comparableIds) =>
        comparableIds.Where(id => !Contains(id)).Distinct().ToList();

    public static bool IsUnchosenDemoSelection(ValuationComparableSelection row) =>
        Contains(row.ComparablePropertyId)
        && string.IsNullOrWhiteSpace(row.SelectedByUserId);
}
