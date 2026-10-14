using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// The failure's effects on Case Study: its review stages as property-timeline milestones (best effort),
/// and the one-line side-effect commands.
/// </summary>
public partial class FailureService
{
    private Task RecordSubmittedAsync(PropertyFailure failure, CancellationToken ct) =>
        RecordStageAsync(failure, "submitted", FailureRules.SubmittedForReviewTitleAr, failure.Title, PropertyTimelineTones.Warn, ct);

    private Task RecordResolvedAsync(PropertyFailure failure, string? reason, CancellationToken ct) =>
        RecordStageAsync(failure, "resolved", FailureRules.ResolvedTitleAr, reason, PropertyTimelineTones.Done, ct);

    private Task RecordApprovedAsync(PropertyFailure failure, string? note, CancellationToken ct) =>
        RecordStageAsync(failure, "approved", FailureRules.ApprovedTitleAr, note, PropertyTimelineTones.Warn, ct);

    private Task RecordReturnedAsync(PropertyFailure failure, string? note, CancellationToken ct) =>
        RecordStageAsync(failure, "returned", FailureRules.ReturnedTitleAr, note, PropertyTimelineTones.Warn, ct);

    private async Task RecordStageAsync(
        PropertyFailure failure,
        string stageKey,
        string title,
        string? detail,
        string tone,
        CancellationToken cancellationToken)
    {
        if (failure.PropertyId == Guid.Empty || string.IsNullOrWhiteSpace(failure.PoNumber)) return;
        try
        {
            await _caseStudy.RecordPropertyTimelineEventAsync(
                FailureRules.StageTimelineEntry(failure, stageKey, title, detail, tone, _time.UtcNow()),
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // best-effort: the stage stands even when the milestone cannot be written
        }
    }

    private Task EscalateTaskObstructionAsync(
        PropertyFailure failure,
        string reason,
        CancellationToken cancellationToken) =>
        _caseStudy.EscalateObstructionAsync(
            FailureRules.EscalateRequest(failure, reason),
            cancellationToken);

    private Task ResolveTaskObstructionAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken) =>
        _caseStudy.ResolveObstructionAsync(
            FailureRules.ResolveObstructionRequest(failure),
            cancellationToken);

    private Task BlockPropertyTasksForApprovedFailureAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken) =>
        _caseStudy.BlockPropertyTasksForFailureAsync(
            FailureRules.BlockTasksRequest(failure),
            cancellationToken);

    private Task SetPropertyDeedStatusAsync(
        PropertyFailure failure,
        string deedStatus,
        CancellationToken cancellationToken) =>
        _caseStudy.SetFailureDeedStatusAsync(
            FailureRules.DeedStatusRequest(failure, deedStatus),
            cancellationToken);
}
