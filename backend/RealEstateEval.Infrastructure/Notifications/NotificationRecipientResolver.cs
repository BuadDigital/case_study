using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Infrastructure.Notifications;

public sealed class NotificationRecipientResolver
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _users;

    public NotificationRecipientResolver(ApplicationDbContext db, UserManager<ApplicationUser> users)
    {
        _db = db;
        _users = users;
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<string> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var assigneeIds = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId)
            .Where(t => taskKinds.Contains(t.Kind))
            .Where(t => t.Status != WorkflowTaskStatus.Completed && t.Status != WorkflowTaskStatus.Cancelled)
            .Where(t => t.AssigneeId != null && t.AssigneeId != "")
            .Select(t => t.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await ResolveUserIdsForDistributionAssigneesAsync(assigneeIds, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<string> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return [];

        var assigneeIds = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PoNumber == po)
            .Where(t => taskKinds.Contains(t.Kind))
            .Where(t => t.Status != WorkflowTaskStatus.Completed && t.Status != WorkflowTaskStatus.Cancelled)
            .Where(t => t.AssigneeId != null && t.AssigneeId != "")
            .Select(t => t.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await ResolveUserIdsForDistributionAssigneesAsync(assigneeIds, cancellationToken);
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

    public async Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
        string prototypeRole,
        CancellationToken cancellationToken = default)
    {
        var role = prototypeRole.Trim().ToLowerInvariant();
        if (role.Length == 0) return [];

        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => p.Status == UserStatus.Active)
            .Select(p => new { p.UserId, p.JobTitle, p.PermissionLevel })
            .ToListAsync(cancellationToken);

        var matches = new List<string>();
        foreach (var profile in profiles)
        {
            var user = await _users.FindByIdAsync(profile.UserId);
            if (user is null) continue;

            var identityRoles = await _users.GetRolesAsync(user);
            var resolved = PrototypeRoleResolver.Resolve(
                new UserProfile
                {
                    UserId = profile.UserId,
                    JobTitle = profile.JobTitle,
                    PermissionLevel = profile.PermissionLevel,
                },
                identityRoles.ToList());

            if (string.Equals(resolved, role, StringComparison.OrdinalIgnoreCase))
                matches.Add(profile.UserId);
        }

        return matches.Distinct(StringComparer.Ordinal).ToList();
    }

    private async Task<IReadOnlyList<string>> ResolveUserIdsForDistributionAssigneesAsync(
        IReadOnlyCollection<string> distributionAssigneeIds,
        CancellationToken cancellationToken)
    {
        if (distributionAssigneeIds.Count == 0) return [];

        return await _db.UserProfiles.AsNoTracking()
            .Where(p => p.DistributionAssigneeId != null && distributionAssigneeIds.Contains(p.DistributionAssigneeId))
            .Select(p => p.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
