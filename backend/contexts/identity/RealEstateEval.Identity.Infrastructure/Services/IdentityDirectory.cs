using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

namespace RealEstateEval.Identity.Infrastructure.Services;

public sealed class IdentityDirectory : IIdentityDirectory
{
    private readonly IdentityDbContext _db;
    private readonly UserLabelLookup _labels;

    public IdentityDirectory(IdentityDbContext db)
    {
        _db = db;
        _labels = new UserLabelLookup(db);
    }

    public Task<string> ResolveAsync(string? raw, CancellationToken cancellationToken = default) =>
        _labels.ResolveAsync(raw, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default) =>
        _labels.ResolveManyAsync(raws, cancellationToken);

    public async Task<IdentityCompensationProfileDto?> GetCompensationByAssigneeAsync(
        string assigneeId,
        CancellationToken cancellationToken = default)
    {
        var aid = assigneeId?.Trim() ?? "";
        if (aid.Length == 0) return null;

        var profile = await _db.UserProfiles.AsNoTracking()
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.DistributionAssigneeId == aid, cancellationToken);
        if (profile is null) return null;

        return new IdentityCompensationProfileDto
        {
            AssigneeId = aid,
            UserId = profile.UserId,
            HasCompensation = profile.HasCompensation,
            ContractType = profile.ContractType,
            ProviderKind = profile.ProcProvider?.ProviderKind,
            EmploymentType = profile.HrEmployee?.EmploymentType,
        };
    }

    public async Task<string?> ResolveUserIdForDistributionAssigneeAsync(
        string distributionAssigneeId,
        CancellationToken cancellationToken = default)
    {
        var assigneeId = distributionAssigneeId.Trim();
        if (assigneeId.Length == 0) return null;

        return await _db.UserProfiles.AsNoTracking()
            .Where(p => p.DistributionAssigneeId == assigneeId)
            .Select(p => p.UserId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string?> ResolveUserIdForEmailAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        var trimmed = email.Trim();
        if (trimmed.Length == 0) return null;

        var normalized = trimmed.ToUpperInvariant();
        return await _db.Users.AsNoTracking()
            .Where(user => user.NormalizedEmail == normalized)
            .Select(user => user.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
        IReadOnlyCollection<string> distributionAssigneeIds,
        CancellationToken cancellationToken = default)
    {
        var assigneeIds = distributionAssigneeIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (assigneeIds.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        var rows = await _db.UserProfiles.AsNoTracking()
            .Where(profile => profile.DistributionAssigneeId != null
                              && assigneeIds.Contains(profile.DistributionAssigneeId))
            .Select(profile => new { profile.DistributionAssigneeId, profile.UserId })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.DistributionAssigneeId!, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().UserId, StringComparer.Ordinal);
    }

    public async Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
        string prototypeRole,
        CancellationToken cancellationToken = default)
    {
        var role = prototypeRole.Trim().ToLowerInvariant();
        if (role.Length == 0) return [];

        return await _db.UserProfiles
            .AsNoTracking()
            .Where(profile =>
                profile.Status == UserStatus.Active
                && profile.RoleId == role)
            .Select(profile => profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByUserIdsAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default)
    {
        var ids = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var rows = await _db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.UserName })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            x => x.Id,
            x => string.IsNullOrWhiteSpace(x.DisplayName) ? x.UserName ?? x.Id : x.DisplayName,
            StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByAssigneeIdsAsync(
        IReadOnlyCollection<string> assigneeIds,
        CancellationToken cancellationToken = default)
    {
        var ids = assigneeIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        var profiles = await (
            from profile in _db.UserProfiles.AsNoTracking()
            join user in _db.Users.AsNoTracking() on profile.UserId equals user.Id
            where profile.DistributionAssigneeId != null
                && ids.Contains(profile.DistributionAssigneeId)
            select new
            {
                AssigneeId = profile.DistributionAssigneeId!,
                user.DisplayName,
            }).ToListAsync(cancellationToken);

        return profiles
            .GroupBy(p => p.AssigneeId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First().DisplayName, StringComparer.Ordinal);
    }
}
