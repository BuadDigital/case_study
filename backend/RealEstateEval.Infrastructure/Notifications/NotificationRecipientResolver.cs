using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

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

    /// <summary>
    /// Maps an assignment-specialist email to the Identity user id via
    /// <see cref="ApplicationUser.NormalizedEmail"/>.
    /// </summary>
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
}
