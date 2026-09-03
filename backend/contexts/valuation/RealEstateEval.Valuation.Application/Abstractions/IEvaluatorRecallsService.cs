using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IEvaluatorRecallsService
{
    Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(
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
