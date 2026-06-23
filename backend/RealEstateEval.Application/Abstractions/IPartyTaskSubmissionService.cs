using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPartyTaskSubmissionService
{
    Task<PartyTaskSubmissionDto?> GetAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PartyTaskSubmissionDto>> ListForTasksAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        CancellationToken cancellationToken = default);

    Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default);
}
