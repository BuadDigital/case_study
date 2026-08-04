using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// D10 adapter: prefer <see cref="IdentityDbContext"/>; residual hosts without Identity pool
/// still resolve via legacy <see cref="ApplicationDbContext"/> Users mapping.
/// <para>
/// Dual public constructors must not be registered with <c>AddScoped&lt;IUserLabelLookup, UserLabelLookup&gt;</c>
/// — DI cannot choose between them when both contexts are registered. Use the factory in
/// <c>AddLegacyApplicationPersistence</c> / failures infrastructure instead.
/// </para>
/// </summary>
public sealed class UserLabelLookup : IUserLabelLookup
{
    private readonly Func<string?, CancellationToken, Task<string>> _resolveOne;
    private readonly Func<IEnumerable<string?>, CancellationToken, Task<IReadOnlyDictionary<string, string>>> _resolveMany;

    public UserLabelLookup(IdentityDbContext db)
    {
        _resolveOne = (raw, ct) => PersonLabelResolver.ResolveAsync(db, raw, ct);
        _resolveMany = (raws, ct) => PersonLabelResolver.ResolveManyAsync(db, raws, ct);
    }

    public UserLabelLookup(ApplicationDbContext db)
    {
        _resolveOne = (raw, ct) => PersonLabelResolver.ResolveAsync(db, raw, ct);
        _resolveMany = (raws, ct) => PersonLabelResolver.ResolveManyAsync(db, raws, ct);
    }

    public Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default) =>
        _resolveOne(raw, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default) =>
        _resolveMany(raws, cancellationToken);
}
