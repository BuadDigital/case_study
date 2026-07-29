using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FieldInspectionWorkspaceService : IFieldInspectionWorkspaceService
{
    private readonly ApplicationDbContext _db;

    public FieldInspectionWorkspaceService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<FieldInspectionWorkspaceListItemDto>> ListAsync(
        PermissionsDto actor,
        CancellationToken cancellationToken = default)
    {
        var query =
            from workspace in _db.FieldInspectionWorkspaces.AsNoTracking()
            join task in _db.WorkflowTasks.AsNoTracking()
                on workspace.WorkflowTaskId equals task.Id
            select new { Workspace = workspace, Task = task };

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
        {
            var role = actor.PrototypeRole?.Trim().ToLower() ?? "";
            var userId = actor.UserId.Trim();
            var assigneeId = actor.DistributionAssigneeId?.Trim() ?? "";
            if (role.Length == 0 || (userId.Length == 0 && assigneeId.Length == 0))
                return [];

            query = query.Where(row =>
                row.Task.AssigneeRole.ToLower() == role
                && ((assigneeId.Length > 0 && row.Task.AssigneeId == assigneeId)
                    || (userId.Length > 0 && row.Task.AssigneeId == userId)));
        }

        return await query
            .OrderByDescending(x => x.Workspace.UpdatedAtUtc)
            .Take(500)
            .Select(x => new FieldInspectionWorkspaceListItemDto
            {
                WorkflowTaskId = x.Workspace.WorkflowTaskId.ToString(),
                PropertyId = x.Workspace.PropertyId.HasValue
                    ? x.Workspace.PropertyId.Value.ToString()
                    : null,
                PoNumber = x.Workspace.PoNumber,
                InspectionDate = x.Workspace.InspectionDate.HasValue
                    ? x.Workspace.InspectionDate.Value.ToString("yyyy-MM-dd")
                    : null,
                InspectionTime = x.Workspace.InspectionTime,
                Status = x.Workspace.Status,
                RequiredPhotoSlots = x.Workspace.RequiredPhotoSlots,
                CompletedPhotoSlots = x.Workspace.CompletedPhotoSlots,
                PendingPhotoApprovals = x.Workspace.PendingPhotoApprovals,
                ObservationCount = x.Workspace.ObservationCount,
                AttachmentCount = x.Workspace.AttachmentCount,
                SubmittedAtUtc = x.Workspace.SubmittedAtUtc.HasValue
                    ? x.Workspace.SubmittedAtUtc.Value.ToString("O")
                    : null,
                UpdatedAtUtc = x.Workspace.UpdatedAtUtc.ToString("O"),
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<FieldInspectionWorkspaceSummaryDto> GetSummaryAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = _db.FieldInspectionWorkspaces.AsNoTracking();
        return new FieldInspectionWorkspaceSummaryDto
        {
            Total = await rows.CountAsync(cancellationToken),
            Draft = await rows.CountAsync(
                x => x.Status == PartyTaskSubmissionStatus.Draft,
                cancellationToken),
            Reopened = await rows.CountAsync(
                x => x.Status == PartyTaskSubmissionStatus.Reopened,
                cancellationToken),
            Submitted = await rows.CountAsync(
                x => x.Status == PartyTaskSubmissionStatus.Submitted,
                cancellationToken),
            PhotosPendingApproval = await rows.SumAsync(
                x => x.PendingPhotoApprovals,
                cancellationToken),
            IncompleteRequiredPhotos = await rows.SumAsync(
                x => x.RequiredPhotoSlots > x.CompletedPhotoSlots
                    ? x.RequiredPhotoSlots - x.CompletedPhotoSlots
                    : 0,
                cancellationToken),
        };
    }
}
