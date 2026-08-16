using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPartyBillingStatementService
{
    Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        string? assigneeId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default);

    Task<PartyBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default);

    Task<CreatePartyBillingStatementResult> CreateStatementAsync(
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Auto-create one draft vendor statement per engineering office with ready lines (month-end sweep).
 /// Skips assignees that already have an open draft this calendar month.
 /// </summary>
    Task<CreateMonthPartyBillingStatementsResult> CreateMonthVendorStatementsAsync(
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> SubmitVendorInvoiceAsync(
        Guid statementId,
        SubmitVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> MatchVendorInvoiceAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> RejectVendorInvoiceAsync(
        Guid statementId,
        RejectVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> CloseStatementAsync(
        Guid statementId,
        ClosePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(PartyBillingStatementDto? Statement, string? Error)> CancelStatementAsync(
        Guid statementId,
        CancelPartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<DeferPartyBillingLinesResult> DeferLinesAsync(
        DeferPartyBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);
}
