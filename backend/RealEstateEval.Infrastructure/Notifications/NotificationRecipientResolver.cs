using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Infrastructure.Notifications;

public sealed class NotificationRecipientResolver
{
    private readonly ApplicationDbContext _db;

    public NotificationRecipientResolver(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        return await (
                from task in _db.WorkflowTasks.AsNoTracking()
                join profile in _db.UserProfiles.AsNoTracking()
                    on task.AssigneeId equals profile.DistributionAssigneeId
                where task.PropertyId == propertyId
                      && taskKinds.Contains(task.Kind)
                      && task.Status != WorkflowTaskStatus.Completed
                      && task.Status != WorkflowTaskStatus.Cancelled
                      && task.AssigneeId != null
                      && task.AssigneeId != ""
                select profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return [];

        return await (
                from task in _db.WorkflowTasks.AsNoTracking()
                join profile in _db.UserProfiles.AsNoTracking()
                    on task.AssigneeId equals profile.DistributionAssigneeId
                where task.PoNumber == po
                      && taskKinds.Contains(task.Kind)
                      && task.Status != WorkflowTaskStatus.Completed
                      && task.Status != WorkflowTaskStatus.Cancelled
                      && task.AssigneeId != null
                      && task.AssigneeId != ""
                select profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
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

        var rows = await (
                from profile in _db.UserProfiles.AsNoTracking()
                where profile.Status == UserStatus.Active
                join userRole in _db.UserRoles.AsNoTracking()
                    on profile.UserId equals userRole.UserId into userRoles
                from userRole in userRoles.DefaultIfEmpty()
                join identityRole in _db.Roles.AsNoTracking()
                    on userRole.RoleId equals identityRole.Id into identityRoles
                from identityRole in identityRoles.DefaultIfEmpty()
                select new
                {
                    profile.UserId,
                    profile.JobTitle,
                    profile.PermissionLevel,
                    IdentityRole = identityRole == null ? null : identityRole.Name,
                })
            .ToListAsync(cancellationToken);

        var matches = new List<string>();
        foreach (var group in rows.GroupBy(row => row.UserId, StringComparer.Ordinal))
        {
            var profile = group.First();
            var identityRoles = group
                .Select(row => row.IdentityRole)
                .Where(roleName => roleName is not null)
                .Cast<string>()
                .Distinct(StringComparer.Ordinal)
                .ToList();
            var resolved = PrototypeRoleResolver.Resolve(
                new UserProfile
                {
                    UserId = profile.UserId,
                    JobTitle = profile.JobTitle,
                    PermissionLevel = profile.PermissionLevel,
                },
                identityRoles);

            if (string.Equals(resolved, role, StringComparison.OrdinalIgnoreCase))
                matches.Add(profile.UserId);
        }

        return matches.Distinct(StringComparer.Ordinal).ToList();
    }
}
