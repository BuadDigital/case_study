using RealEstateEval.Application;
using RealEstateEval.Failures.Application.Rules;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// System-owned holds: the eviction hold raised from the circumstances unit and the
/// key-unmatched failure raised from the field, plus the case-study task block/unblock each one
/// drives.
/// </summary>
public partial class FailureService
{
    public async Task ApplyEvictionHoldAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var propertyKey)) return;
        var now = _time.UtcNow();

        var existing = await _failures.FindLatestUnresolvedAsync(
            po, propertyKey, cancellationToken);

        if (existing is not null)
        {
            if (FailureRecordRules.NeedsEvictionRefresh(existing))
            {
                existing.TryForceSuspend(FailureRules.EvictionSuspendNote, now);
                existing.RefreshOpenHold(
                    FailureRules.EvictionProblemTypeId,
                    FailureRules.EvictionTitle,
                    FailureRules.EvictionSuspendNote,
                    now);
                await _failures.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskForHoldAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        var resolvedSpecialist = await _labels.ResolveAsync(
            FailureRules.ActorOrSystem(specialist),
            cancellationToken);
        await _failures.AddAsync(
            FailureRules.NewEvictionHold(po, propertyKey, deedNumber, resolvedSpecialist, now),
            cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(
            po,
            propertyKey,
            FailureRules.EvictionTitle,
            cancellationToken);
    }

    public async Task ResolveEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var propertyKey)) return;
        var now = _time.UtcNow();

        var active = await _failures.FindOpenEvictionHoldsAsync(
            po, propertyKey, FailureRules.EvictionProblemTypeId, cancellationToken);

        if (active.Count == 0)
        {
            await UnblockCaseStudyTaskForHoldAsync(po, propertyKey, cancellationToken);
            return;
        }

        var actorName = FailureRules.ActorOrSystem(actor);

        foreach (var failure in active)
        {
            failure.TrySystemResolve(
                FailureRules.EvictionResolutionReason,
                FailureRules.EvictionContinueInstructions,
                now,
                finalNoteIfEmpty: FailureRules.EvictionLiftedNote(actorName));
        }

        await _failures.SaveChangesAsync(cancellationToken);
        await UnblockCaseStudyTaskForHoldAsync(po, propertyKey, cancellationToken);
    }

    public async Task EnsureKeyUnmatchedFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (!FailureRules.TryParsePropertyId(propertyId, out var propertyKey)) return;
        var active = await _failures.HasUnresolvedAsync(po, propertyKey, cancellationToken);
        if (active) return;

        var now = _time.UtcNow();
        var resolvedSpecialist = await _labels.ResolveAsync(
            FailureRules.ActorOrSystem(specialist),
            cancellationToken);
        await _failures.AddAsync(
            FailureRules.NewKeyUnmatchedFailure(
                po, propertyKey, deedNumber, resolvedSpecialist, now),
            cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(
            po,
            propertyKey,
            FailureRules.KeyUnmatchedTitle,
            cancellationToken);
    }

    private async Task BlockCaseStudyTaskForHoldAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken)
    {
        var task = await _caseStudy.BlockTaskForHoldAsync(
            FailureRecordRules.HoldTaskRequest(poNumber, propertyId, reason),
            cancellationToken);
        if (task is null) return;

        await NotifyHoldSpecialistAsync(
            task.AssigneeId,
            FailureRules.CaseStudyBlockedNotification(task.TaskId, reason),
            cancellationToken);
    }

    private async Task UnblockCaseStudyTaskForHoldAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var task = await _caseStudy.UnblockTaskForHoldAsync(
            FailureRecordRules.HoldTaskRequest(poNumber, propertyId),
            cancellationToken);
        if (task is null) return;

        await NotifyHoldSpecialistAsync(
            task.AssigneeId,
            FailureRules.CaseStudyUnblockedNotification(task.TaskId),
            cancellationToken);
    }
}
