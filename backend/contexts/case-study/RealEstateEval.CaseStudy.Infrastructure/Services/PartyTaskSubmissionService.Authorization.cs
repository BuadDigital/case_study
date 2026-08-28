using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public partial class PartyTaskSubmissionService
{
    private async Task<bool> CanReadTaskAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => new
            {
                t.AssigneeId,
                t.Kind,
                t.Status,
                t.PropertyId,
                t.ParentTaskId,
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (task is null) return false;

        if (PoRoleMatrixRules.CanReadPartyTask(
            actor.PrototypeRole,
            task.AssigneeId,
            actor.UserId,
            actor.DistributionAssigneeId))
            return true;

        // Appraisers / EO need completed sibling field-inspection facts for report & gates
        // even though party visibility hides the inspection row from their task list.
        return await CanReadCompletedSiblingFieldInspectionAsync(
            task.Kind,
            task.Status,
            task.PropertyId,
            task.ParentTaskId,
            actor,
            cancellationToken);
    }

    private async Task<List<Guid>> ReadableTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        var tasks = await _db.WorkflowTasks
            .AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id,
                t.AssigneeId,
                t.Kind,
                t.Status,
                t.PropertyId,
                t.ParentTaskId,
            })
            .ToListAsync(cancellationToken);

        // فحص الشقيق دفعةً — كان AnyAsync لكل مهمة غير مخوّلة في نفس الطلب.
        var actorIds = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(actor.UserId))
            actorIds.Add(actor.UserId.Trim());
        if (!string.IsNullOrWhiteSpace(actor.DistributionAssigneeId))
            actorIds.Add(actor.DistributionAssigneeId.Trim());

        var siblingCandidates = tasks
            .Where(t =>
                t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed
                && t.PropertyId != null
                && t.ParentTaskId != null)
            .ToList();
        var siblingReadable = new HashSet<Guid>();
        if (siblingCandidates.Count > 0 && actorIds.Count > 0)
        {
            var parentIds = siblingCandidates
                .Select(t => t.ParentTaskId!.Value)
                .Distinct()
                .ToList();
            var propertyIds = siblingCandidates
                .Select(t => t.PropertyId!.Value)
                .Distinct()
                .ToList();
            var matches = await _db.WorkflowTasks.AsNoTracking()
                .Where(t =>
                    t.ParentTaskId != null
                    && parentIds.Contains(t.ParentTaskId.Value)
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value)
                    && (t.Kind == WorkflowTaskKind.PropertyAppraisal
                        || t.Kind == WorkflowTaskKind.EngineeringSurvey)
                    && t.AssigneeId != null
                    && actorIds.Contains(t.AssigneeId))
                .Select(t => new { t.ParentTaskId, t.PropertyId })
                .ToListAsync(cancellationToken);
            var pairSet = matches
                .Select(m => (m.ParentTaskId!.Value, m.PropertyId!.Value))
                .ToHashSet();
            foreach (var candidate in siblingCandidates)
            {
                if (pairSet.Contains(
                        (candidate.ParentTaskId!.Value, candidate.PropertyId!.Value)))
                    siblingReadable.Add(candidate.Id);
            }
        }

        var readable = new List<Guid>(tasks.Count);
        foreach (var task in tasks)
        {
            if (PoRoleMatrixRules.CanReadPartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId)
                || siblingReadable.Contains(task.Id))
            {
                readable.Add(task.Id);
            }
        }

        return readable;
    }

    /// <summary>
    /// Property-appraisal / engineering-survey assignees on the same parent+property may
    /// read a completed field-inspection submission (party lists hide that sibling row).
    /// </summary>
    private async Task<bool> CanReadCompletedSiblingFieldInspectionAsync(
        WorkflowTaskKind kind,
        WorkflowTaskStatus status,
        Guid? propertyId,
        Guid? parentTaskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (kind != WorkflowTaskKind.FieldInspection
            || status != WorkflowTaskStatus.Completed
            || propertyId is null
            || parentTaskId is null)
            return false;

        var actorIds = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(actor.UserId))
            actorIds.Add(actor.UserId.Trim());
        if (!string.IsNullOrWhiteSpace(actor.DistributionAssigneeId))
            actorIds.Add(actor.DistributionAssigneeId.Trim());
        if (actorIds.Count == 0) return false;

        return await _db.WorkflowTasks
            .AsNoTracking()
            .AnyAsync(
                t =>
                    t.ParentTaskId == parentTaskId
                    && t.PropertyId == propertyId
                    && (t.Kind == WorkflowTaskKind.PropertyAppraisal
                        || t.Kind == WorkflowTaskKind.EngineeringSurvey)
                    && t.AssigneeId != null
                    && actorIds.Contains(t.AssigneeId),
                cancellationToken);
    }
}
