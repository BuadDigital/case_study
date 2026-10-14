using RealEstateEval.Application;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// The case specialist's lift of the engineering-survey freeze a failure puts on a property. The
/// failure itself stays active (blocking badges, the study-report gate); only the survey gate
/// stops asking about it, and a failure raised after the lift freezes the survey again.
/// </summary>
public partial class FailureService
{
    public async Task<(LiftSurveyFreezeResultDto? Result, Dictionary<string, string>? Errors)> LiftSurveyFreezeAsync(
        LiftSurveyFreezeRequest request,
        string? actorUserId,
        string? actorPrototypeRole,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanLiftSurveyFreeze(actorPrototypeRole))
            return (null, new Dictionary<string, string> { ["_"] = FailureRecordRules.LiftSurveyFreezeRoleDeniedAr });

        var errors = FailureRecordRules.ValidateLiftSurveyFreeze(request);
        if (errors.Count > 0) return (null, errors);

        var po = request.PoNumber.Trim();
        var propertyId = FailureRules.ParsePropertyId(request.PropertyId);
        var reason = request.Reason.Trim();

        var freezing = await _failures.FindSurveyFreezingForPropertyAsync(po, propertyId, cancellationToken);
        var now = _time.UtcNow();
        var lifted = freezing.Where(f => f.LiftSurveyFreeze(actorUserId, reason, now)).ToList();
        if (lifted.Count == 0)
            return (new LiftSurveyFreezeResultDto { Lifted = 0 }, null);

        await _failures.SaveChangesAsync(cancellationToken);

        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId.Trim(),
            action: "failures.survey-freeze.lifted",
            entityType: "PropertyFailure",
            entityId: lifted[0].Id.ToString("D"),
            before: null,
            after: new
            {
                reason,
                poNumber = po,
                propertyId = propertyId.ToString("D"),
                failureIds = lifted.Select(f => f.Id.ToString("D")).ToArray(),
            }), cancellationToken);

        await _caseStudy.RecordPropertyTimelineEventAsync(
            FailureRules.SurveyFreezeLiftedTimelineEntry(lifted[0], reason, now),
            cancellationToken);

        await NotifySurveyAssigneesAsync(po, propertyId, reason, cancellationToken);

        return (new LiftSurveyFreezeResultDto { Lifted = lifted.Count }, null);
    }

    /// <summary>
    /// Tells the assignee of each still-open engineering-survey task of the property. The Failures
    /// context reads the survey tasks through <c>ICaseStudyLookup</c> and turns the distribution
    /// assignee into a user id through the shared recipient resolver; an unassigned task is skipped.
    /// </summary>
    private async Task NotifySurveyAssigneesAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken)
    {
        var surveyTasks = await _caseStudyLookup.ListWorkflowTasksByPropertyAsync(
            propertyId,
            [WorkflowTaskKind.EngineeringSurvey],
            cancellationToken);

        foreach (var task in surveyTasks)
        {
            if (WorkflowTaskStatusValues.IsTerminalValue(task.Status)) continue;
            await NotifyHoldSpecialistAsync(
                task.AssigneeId,
                FailureRules.SurveyFreezeLiftedNotification(task.Id, poNumber, reason),
                cancellationToken);
        }
    }
}
