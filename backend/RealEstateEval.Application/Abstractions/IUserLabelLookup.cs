namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Pure-read lookup of display labels for users and system tokens.
/// Implementation today loads Identity tables via residual <c>ApplicationDbContext</c>
/// ; can rebind this interface to Identity without changing call sites.
/// </summary>
public interface IUserLabelLookup
{
    Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default);
}
