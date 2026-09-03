using RealEstateEval.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Identity.Infrastructure.Services;

/// <summary>
/// D10: user-label resolution reads the Identity owner context. Hosts without an Identity
/// pool use the HTTP directory (<c>AddRemoteIdentityDirectory</c>) instead of this class.
/// A8: absorbed the EF halves of PersonLabelResolver when it moved beside its context.
/// </summary>
public sealed class UserLabelLookup(IdentityDbContext db) : IUserLabelLookup
{
    public Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default) =>
        ResolveFromUsersAsync(db.Users.AsNoTracking(), raw, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default) =>
        ResolveManyFromUsersAsync(db.Users.AsNoTracking(), raws, cancellationToken);

    private static async Task<string> ResolveFromUsersAsync(
        IQueryable<ApplicationUser> users,
        string? raw,
        CancellationToken cancellationToken)
    {
        var normalized = PersonLabelResolver.NormalizeSystemLabel(raw);
        if (normalized.Length == 0) return "";
        if (!PersonLabelResolver.LooksLikeUserId(normalized)) return normalized;

        var name = await users
            .Where(u => u.Id == normalized)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(name) ? normalized : name.Trim();
    }

    private static async Task<IReadOnlyDictionary<string, string>> ResolveManyFromUsersAsync(
        IQueryable<ApplicationUser> users,
        IEnumerable<string?> raws,
        CancellationToken cancellationToken)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in raws)
        {
            var value = raw?.Trim() ?? "";
            if (PersonLabelResolver.LooksLikeUserId(value)) ids.Add(value);
        }

        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var names = await users
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in names)
        {
            if (!string.IsNullOrWhiteSpace(row.DisplayName))
                map[row.Id] = row.DisplayName.Trim();
        }

        return map;
    }
}
