using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// The inspector's «نسخ من معاملة سابقة» (2026-11-01 ruling): the answers of an earlier inspection of the
/// same deed fill this draft, photos excluded (<see cref="PriorInspectionCopyRules"/>).
/// </summary>
public sealed class PriorInspectionCopyService(
    IPartyTaskSubmissionRepository repo,
    IWorkOrderQuery workOrders,
    IPropertyTimelineService timeline,
    IAuditLogWriter audit,
    IAuditLogAppend auditLog,
    TimeProvider? time = null) : IPriorInspectionCopyService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    /// <summary>
    /// The inspections this task may copy.
    /// How it works: the task's deed gives its earlier registrations on other work orders, and those
    /// give their submitted field inspections, newest first.
    /// Edge cases: only the assigned inspector, on an inspection not yet sent, gets a list — the deed
    /// history stays closed to field parties otherwise. A property without a deed number has none.
    /// </summary>
    public async Task<IReadOnlyList<PriorInspectionOptionDto>> ListAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default) =>
        (await ListSourcesAsync(taskId, actor, cancellationToken)).Options;

    /// <summary>
    /// Hands one listed inspection's answers to the inspector's draft.
    /// How it works: the source must be in this task's list; the copy is written to the timeline and the
    /// audit log, so a reviewer can tell copied answers from answers taken on site.
    /// Edge cases: nothing is saved here — the draft saves the answers as the inspector's own edits.
    /// </summary>
    public async Task<PriorInspectionCopyDto?> CopyAsync(
        Guid taskId,
        Guid sourceTaskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var (task, options, sources) = await ListSourcesAsync(taskId, actor, cancellationToken);
        var option = options.FirstOrDefault(o => o.SourceTaskId == sourceTaskId);
        var source = sources.FirstOrDefault(s => s.WorkflowTaskId == sourceTaskId);
        if (task?.PropertyId is not Guid propertyId || option is null || source is null) return null;

        var now = _time.UtcNow();
        await timeline.RecordAsync(
            task.PoNumber,
            propertyId,
            $"inspection-copied:{task.Id}:{now.Ticks}",
            "نسخ بيانات من معاينة سابقة",
            $"من {option.PoNumber} — بدون الصور — {actor.DisplayName}",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);
        await auditLog.AppendAsync(audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId,
            action: "case-study.inspection.copied-from-prior",
            entityType: "WorkflowTask",
            entityId: task.Id.ToString("D"),
            before: null,
            after: new { sourceTaskId, sourcePoNumber = option.PoNumber, poNumber = task.PoNumber }),
            cancellationToken);

        return new PriorInspectionCopyDto
        {
            SourceTaskId = sourceTaskId,
            PoNumber = option.PoNumber,
            Payload = PriorInspectionCopyRules.CopyablePayload(source.PayloadJson),
        };
    }

    private async Task<(WorkflowTask? Task, IReadOnlyList<PriorInspectionOptionDto> Options, IReadOnlyList<PartyTaskSubmission> Sources)>
        ListSourcesAsync(Guid taskId, PartySubmissionActor actor, CancellationToken cancellationToken)
    {
        var task = await repo.GetTaskAsync(taskId, cancellationToken);
        if (task?.PropertyId is not Guid propertyId
            || task.Kind != WorkflowTaskKind.FieldInspection
            || !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
            return (task, [], []);

        var own = await repo.GetSubmissionAsync(taskId, track: false, cancellationToken);
        if (own?.Status == PartyTaskSubmissionStatus.Submitted) return (task, [], []);

        var property = await repo.GetPropertyWithContactsAsync(propertyId, cancellationToken);
        var deed = property?.DeedNumber?.Trim();
        if (string.IsNullOrEmpty(deed)) return (task, [], []);

        var priors = await workOrders.ListPriorDeedsAsync(deed, task.PoNumber, cancellationToken, propertyId);
        var byProperty = priors
            .GroupBy(p => p.PropertyId)
            .ToDictionary(g => g.Key, g => g.First());
        var sources = (await repo.ListSubmittedFieldInspectionsAsync(byProperty.Keys, cancellationToken))
            .OrderByDescending(s => s.SubmittedAtUtc)
            .ToList();
        var options = sources
            .Select(s =>
            {
                var prior = byProperty[s.PropertyId!.Value];
                return new PriorInspectionOptionDto
                {
                    SourceTaskId = s.WorkflowTaskId,
                    PoNumber = prior.PoNumber,
                    City = prior.City,
                    District = prior.District,
                    InspectorName = s.SubmittedByName,
                    SubmittedAtUtc = s.SubmittedAtUtc,
                };
            })
            .ToList();
        return (task, options, sources);
    }
}
