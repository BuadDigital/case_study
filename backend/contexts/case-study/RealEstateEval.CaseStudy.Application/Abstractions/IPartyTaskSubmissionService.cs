using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IPartyTaskSubmissionService
{
 /// <summary>
 /// Reads one submission. When <paramref name="actor"/> is supplied the caller must pass
 /// <see cref="Rules.PoRoleMatrixRules.CanReadPartyTask"/>; otherwise null is returned so
 /// callers cannot distinguish "missing" from "not yours".
 /// When the task exists and the actor may read it, an unsaved empty draft is returned
 /// instead of null so first open is 200 rather than 404.
 /// </summary>
    Task<PartyTaskSubmissionDto?> GetAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Reads submissions for the given tasks. When <paramref name="actor"/> is supplied,
 /// tasks the actor may not read are silently dropped rather than failing the batch.
 /// </summary>
    Task<IReadOnlyList<PartyTaskSubmissionDto>> ListForTasksAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Who a return of the inspection package may affect (the sibling appraiser / engineering office with
 /// their package state, suggested by the fixed section map) and the study-report / valuation facts the
 /// decision needs. Case staff only (<c>CanManagePartySubmissions</c>). <c>(null, null)</c> = no such task.
 /// </summary>
    Task<(ReturnImpactDto? Result, Dictionary<string, string>? Errors)> GetReturnImpactAsync(
        Guid inspectionTaskId,
        IReadOnlyCollection<string>? sections,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Returns the inspection package for correction and applies the specialist's decision on the affected
 /// parties in ONE transaction: their submitted packages are reopened (a deposited appraisal is only
 /// notified), the others notified; an issued study report needs an explicit keep / reopen choice
 /// (field error <c>studyReport</c>). Works after acceptance. Replays are idempotent.
 /// </summary>
    Task<(ReturnInspectionResultDto? Result, Dictionary<string, string>? Errors)> ReturnInspectionAsync(
        Guid inspectionTaskId,
        ReturnInspectionRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Specialist accepts engineering-survey outputs — triggers fee accrual from the pricing table.
 /// </summary>
    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Approved appraiser recall: reopens the appraisal package for the deciding specialist.
 /// Idempotent — a package that is not submitted is a no-op (valuation retries safely).
 /// </summary>
    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenForRecallAsync(
        Guid taskId,
        ReopenForRecallRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// A deposited valuation report is reopened as a new version (n+1) by the case specialist: the appraiser's
 /// submitted package goes back to him and his completed task opens again — the one case the plain return
 /// refuses. Idempotent: a package already returned only makes sure the task is open.
 /// </summary>
    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenForNewVersionAsync(
        Guid taskId,
        ReopenForNewVersionRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);
}
