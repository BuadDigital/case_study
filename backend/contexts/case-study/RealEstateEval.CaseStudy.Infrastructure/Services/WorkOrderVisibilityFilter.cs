using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkOrderVisibilityFilter : IWorkOrderVisibilityFilter
{
    private readonly CaseStudyDbContext _db;

    public WorkOrderVisibilityFilter(CaseStudyDbContext db)
    {
        _db = db;
    }

    public async Task<HashSet<string>?> ResolveVisiblePoNumbersAsync(
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (actor is null)
            return new HashSet<string>(StringComparer.Ordinal);

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)
            || actor.Capabilities.Contains("manage-work-orders", StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        var assigneeId = actor.DistributionAssigneeId?.Trim() ?? "";
        var userId = actor.UserId.Trim();
        if (assigneeId.Length == 0 && userId.Length == 0)
            return new HashSet<string>(StringComparer.Ordinal);

        var query = _db.WorkflowTasks.AsNoTracking().AsQueryable();
        if (assigneeId.Length > 0 && userId.Length > 0)
            query = query.Where(t => t.AssigneeId == assigneeId || t.AssigneeId == userId);
        else if (assigneeId.Length > 0)
            query = query.Where(t => t.AssigneeId == assigneeId);
        else
            query = query.Where(t => t.AssigneeId == userId);

        var pos = await query
            .Where(t => t.PoNumber != null && t.PoNumber != "")
            .Select(t => t.PoNumber)
            .Distinct()
            .ToListAsync(cancellationToken);

        return pos
            .Select(p => p.Trim())
            .Where(p => p.Length > 0)
            .ToHashSet(StringComparer.Ordinal);
    }

    public async Task<bool> CanReadPoAsync(
        string poNumber,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var visiblePos = await ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is null) return true;
        return visiblePos.Contains(poNumber.Trim());
    }
}
