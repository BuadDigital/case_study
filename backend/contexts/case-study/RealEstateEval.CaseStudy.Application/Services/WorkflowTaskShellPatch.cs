using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>What a task looked like before a shell patch — the post-patch rules compare against it.</summary>
public readonly record struct WorkflowTaskPatchSnapshot(
    bool WasBlocked,
    string? PreviousAssigneeId,
    bool WasCompletedCaseStudy);

/// <summary>
/// The one mapping from a <see cref="PatchWorkflowTaskRequest"/> onto
/// <see cref="WorkflowTask.ApplyShellPatch"/>, shared by the lifecycle commands and the
/// stream shell patcher so the two paths cannot drift.
/// </summary>
public static class WorkflowTaskShellPatch
{
    /// <summary>Applies the request to the task and returns the state it had before.</summary>
    public static WorkflowTaskPatchSnapshot Apply(
        WorkflowTask entity,
        PatchWorkflowTaskRequest request,
        DateTime nowUtc)
    {
        var before = new WorkflowTaskPatchSnapshot(
            WasBlocked: entity.Status == WorkflowTaskStatus.Blocked,
            PreviousAssigneeId: entity.AssigneeId,
            WasCompletedCaseStudy: WorkflowTaskLifecycleRules.IsCompletedCaseStudy(entity));

        entity.ApplyShellPatch(
            phase: WorkflowTaskPhaseValues.ParseOptional(request.Phase),
            status: request.Status is null ? null : WorkflowTaskStatusValues.Parse(request.Status),
            title: request.Title,
            assigneeRole: request.AssigneeRole,
            assigneeName: request.AssigneeName,
            assigneeId: request.AssigneeId,
            assigneeIdProvided: request.AssigneeId is not null,
            propertyId: string.IsNullOrWhiteSpace(request.PropertyId)
                ? null
                : Guid.Parse(request.PropertyId),
            propertyIdProvided: request.PropertyId is not null,
            obstructionReason: string.IsNullOrWhiteSpace(request.ObstructionReason)
                ? null
                : request.ObstructionReason,
            obstructionReasonProvided: request.ObstructionReason is not null,
            obstructionPriorPhase: WorkflowTaskPhaseValues.ParseOptional(request.ObstructionPriorPhase),
            obstructionPriorPhaseProvided: request.ObstructionPriorPhase is not null,
            distributionJson: request.Distribution is null
                ? null
                : WorkflowTaskMapper.SerializeDistribution(
                    WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution)),
            nowUtc: nowUtc);

        return before;
    }
}
