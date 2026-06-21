using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IEvaluatorRecallsService
{
    Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(
        string? status,
        CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> GetAsync(string taskId, CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto> RequestAsync(
        CreateEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> ApproveAsync(string taskId, CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> RejectAsync(
        string taskId,
        RejectEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default);
}
