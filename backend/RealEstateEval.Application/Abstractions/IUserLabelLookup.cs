namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Pure-read lookup of display labels for users and system tokens. Implemented over the
/// Identity context (in-process) or the Identity HTTP directory (cross-service).
/// </summary>
public interface IUserLabelLookup
{
    Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default);
}
