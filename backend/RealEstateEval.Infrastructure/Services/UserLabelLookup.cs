using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// D10: user-label resolution reads the Identity owner context. Hosts without an Identity
/// pool use the HTTP directory (<c>AddRemoteIdentityDirectory</c>) instead of this class.
/// </summary>
public sealed class UserLabelLookup(IdentityDbContext db) : IUserLabelLookup
{
    public Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default) =>
        PersonLabelResolver.ResolveAsync(db, raw, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default) =>
        PersonLabelResolver.ResolveManyAsync(db, raws, cancellationToken);
}
