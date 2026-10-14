using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class PartyTaskSubmissionService
{
    /// <summary>Return note used when the appraiser gave no reason for the recall.</summary>
    public const string RecallDefaultReturnNoteAr = "استرجاع تقرير التقييم بقرار الأخصائي";

    public const string RecallReopenForbiddenAr = "قرار استرجاع التقييم للأخصائي فقط";

    /// <summary>
    /// The appraiser's recall was approved: send his package back for correction. Called by
    /// valuation BEFORE it records the approval, and retried safely when the second step fails,
    /// so it is idempotent — a package that is not Submitted (already reopened, still a draft,
    /// or never saved) is a no-op that returns the current state. The deciding specialist is the
    /// actor (his bearer is forwarded), so the reopen carries his name.
    /// </summary>
    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenForRecallAsync(
        Guid taskId,
        ReopenForRecallRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanDecideAppraisalRecall(actor.PrototypeRole))
            return (null, Error(RecallReopenForbiddenAr));

        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));
        if (task.Kind != WorkflowTaskKind.PropertyAppraisal)
            return (null, Error("الاسترجاع خاص بتقييم العقار"));

        if (!await IsSubmittedAsync(taskId, cancellationToken))
            return (await GetAsync(taskId, null, cancellationToken), null);

        var reason = request.Reason?.Trim() ?? "";
        var (result, errors) = await ReopenAsync(
            taskId,
            new ReopenPartyTaskSubmissionRequest
            {
                ReturnNote = reason.Length == 0 ? RecallDefaultReturnNoteAr : reason,
            },
            actor,
            cancellationToken);

        // Two retries racing: the loser finds the package already reopened — that is the goal.
        if (errors is not null && !await IsSubmittedAsync(taskId, cancellationToken))
            return (await GetAsync(taskId, null, cancellationToken), null);

        return (result, errors);
    }

    private async Task<bool> IsSubmittedAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var entity = await _repo.GetSubmissionAsync(taskId, track: false, cancellationToken);
        return entity?.Status == PartyTaskSubmissionStatus.Submitted;
    }
}
