using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Notifications;

/// <summary>
/// Resolves notification recipients (A6 — no residual ApplicationDbContext).
/// Workflow assignee lookups use residual <see cref="CaseStudyDbContext"/>; profile and email
/// maps use <see cref="IdentityDbContext"/>. Pure hosts that construct this must register both
/// (Platform notification consumer does; Phase 3 removes the CS residual).
/// </summary>
public sealed class NotificationRecipientResolver
{
    private readonly CaseStudyDbContext _caseStudy;
    private readonly IdentityDbContext _identity;

    public NotificationRecipientResolver(CaseStudyDbContext caseStudy, IdentityDbContext identity)
    {
        _caseStudy = caseStudy;
        _identity = identity;
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var assigneeIds = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(task =>
                task.PropertyId == propertyId
                && taskKinds.Contains(task.Kind)
                && task.Status != WorkflowTaskStatus.Completed
                && task.Status != WorkflowTaskStatus.Cancelled
                && task.AssigneeId != null
                && task.AssigneeId != "")
            .Select(task => task.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await MapAssigneesToUserIdsAsync(assigneeIds, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return [];

        var assigneeIds = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(task =>
                task.PoNumber == po
                && taskKinds.Contains(task.Kind)
                && task.Status != WorkflowTaskStatus.Completed
                && task.Status != WorkflowTaskStatus.Cancelled
                && task.AssigneeId != null
                && task.AssigneeId != "")
            .Select(task => task.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await MapAssigneesToUserIdsAsync(assigneeIds, cancellationToken);
    }

    public async Task<string?> ResolveUserIdForDistributionAssigneeAsync(
        string distributionAssigneeId,
        CancellationToken cancellationToken = default)
    {
        var assigneeId = distributionAssigneeId.Trim();
        if (assigneeId.Length == 0) return null;

        return await _identity.UserProfiles.AsNoTracking()
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
        return await _identity.Users.AsNoTracking()
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

        var rows = await _identity.UserProfiles.AsNoTracking()
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

        return await _identity.UserProfiles
            .AsNoTracking()
            .Where(profile =>
                profile.Status == UserStatus.Active
                && profile.RoleId == role)
            .Select(profile => profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<string>> MapAssigneesToUserIdsAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken)
    {
        if (assigneeIds.Count == 0) return [];

        return await _identity.UserProfiles.AsNoTracking()
            .Where(profile =>
                profile.DistributionAssigneeId != null
                && assigneeIds.Contains(profile.DistributionAssigneeId))
            .Select(profile => profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
