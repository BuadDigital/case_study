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

 /// <summary>
 /// Ready lines with the search and sort of pagination-contract §9.2 applied, capped as the
 /// legacy list is. Plain array — the caller sent no page window.
 /// </summary>
    Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        PartyBillingReadyLineListQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// One page of ready lines. The rows are synthesised, so the page is cut over the materialised
 /// list and <c>TotalCount</c> is that list's length — pagination-contract §9.2.
 /// </summary>
    Task<PagedResultDto<PartyBillingReadyLineDto>> ListReadyLinesPagedAsync(
        PartyBillingReadyLineListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

 /// <summary>Statements with the filters, search and sort of pagination-contract §9.1; plain array.</summary>
    Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        PartyBillingStatementListQuery query,
        CancellationToken cancellationToken = default);

 /// <summary>One page of statements, counted and cut in the database — pagination-contract §9.1.</summary>
    Task<PagedResultDto<PartyBillingStatementDto>> ListStatementsPagedAsync(
        PartyBillingStatementListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<PartyBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default);

    Task<CreatePartyBillingStatementResponseDto> CreateStatementAsync(
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Auto-create one draft vendor statement per engineering office with ready lines (month-end sweep).
 /// Skips assignees that already have an open draft this calendar month.
 /// </summary>
    Task<CreateMonthPartyBillingStatementsResponseDto> CreateMonthVendorStatementsAsync(
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

    Task<DeferPartyBillingLinesResponseDto> DeferLinesAsync(
        DeferPartyBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);
}
