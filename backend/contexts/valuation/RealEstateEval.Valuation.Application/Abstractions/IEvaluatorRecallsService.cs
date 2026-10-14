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

    /// <summary>
    /// The case specialist's decision. Approve reopens the appraiser's package FIRST (trusted,
    /// idempotent call to Case Study) and only then records the approval; when that call fails
    /// the recall stays pending. A recall of a DEPOSITED report (code recorded) reopens it as a new version (n+1)
    /// instead — the same single operation the specialist's reopen uses. Result and errors both null means the recall does not exist;
    /// an already-decided recall is returned unchanged.
    /// </summary>
    Task<(EvaluatorRecallDto? Result, Dictionary<string, string>? Errors)> DecideAsync(
        string taskId,
        DecideEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default,
        string? actorUserId = null);
}
