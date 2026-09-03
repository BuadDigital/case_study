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
 /// Specialist accepts engineering-survey outputs — triggers fee accrual from the pricing table.
 /// </summary>
    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);
}
