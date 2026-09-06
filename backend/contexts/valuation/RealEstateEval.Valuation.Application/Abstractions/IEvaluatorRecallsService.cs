using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IEvaluatorRecallsService
{
    Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(
        CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> GetAsync(string taskId, CancellationToken cancellationToken = default);

    /// <summary>Returns the row, or an error when the task or property id is not a valid Guid.</summary>
    Task<(EvaluatorRecallDto? Result, string? Error)> RequestAsync(
        CreateEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> ApproveAsync(string taskId, CancellationToken cancellationToken = default);

    Task<EvaluatorRecallDto?> RejectAsync(
        string taskId,
        RejectEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default);
}
