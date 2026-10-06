using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class PartyTaskSubmissionService
{
    public const string NewVersionForbiddenAr = "إعادة فتح التقرير بنسخة جديدة للأخصائي فقط";

    /// <summary>Return note used when the specialist gave no reason for the new version.</summary>
    public const string NewVersionDefaultReturnNoteAr = "فتح التقرير بنسخة جديدة بقرار الأخصائي";

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenForNewVersionAsync(
        Guid taskId,
        ReopenForNewVersionRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanReopenValuationReport(actor.PrototypeRole))
            return (null, Error(NewVersionForbiddenAr));

        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));
        if (task.Kind != WorkflowTaskKind.PropertyAppraisal)
            return (null, Error("النسخة الجديدة خاصة بتقييم العقار"));

        // A retry after the package was already returned: only make sure the task is open again.
        if (!await IsSubmittedAsync(taskId, cancellationToken))
        {
            if (task.Status == WorkflowTaskStatus.Completed)
            {
                await _tasks.PatchAsync(
                    taskId,
                    new PatchWorkflowTaskRequest
                    {
                        Status = WorkflowTaskStatusValues.Open,
                        Phase = WorkflowTaskPhaseValues.Done,
                    },
                    cancellationToken);
            }

            return (await GetAsync(taskId, null, cancellationToken), null);
        }

        var reason = request.Reason?.Trim() ?? "";
        return await ReopenCoreAsync(
            taskId,
            task,
            reason.Length == 0 ? NewVersionDefaultReturnNoteAr : reason,
            actor,
            cancellationToken);
    }
}
