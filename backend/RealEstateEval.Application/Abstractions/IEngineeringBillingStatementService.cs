using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IEngineeringBillingStatementService
{
    Task<IReadOnlyList<EngBillingReadyLineDto>> ListReadyLinesAsync(
        string? assigneeId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EngBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default);

    Task<EngBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default);

    Task<CreateEngBillingStatementResult> CreateStatementAsync(
        CreateEngBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(EngBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(EngBillingStatementDto? Statement, string? Error)> CloseStatementAsync(
        Guid statementId,
        CloseEngBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<DeferEngBillingLinesResult> DeferLinesAsync(
        DeferEngBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);
}
