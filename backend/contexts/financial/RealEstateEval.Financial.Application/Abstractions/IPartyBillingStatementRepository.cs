using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Persistence boundary for party billing statements: the statements and their lines, the
/// inspector-fee ledgers and court-visit charges a line settles, and the reference sequence.
/// The use case in <c>Financial.Application</c> composes these calls; only the Infrastructure
/// adapter opens EF.
/// </summary>
/// <remarks>
/// Reads take a <c>track</c> flag where both modes are needed: the write paths mutate the
/// ledgers and charges they read and commit them with <see cref="SaveChangesAsync"/>, while the
/// list/detail paths take untracked rows.
/// </remarks>
public interface IPartyBillingStatementRepository
{
    /// <summary>
    /// Every line key already on a statement. The key is the workflow task id for ledger lines
    /// and the charge id for court-visit lines, so one set covers both and nothing is re-billed.
    /// </summary>
    Task<IReadOnlySet<Guid>> ListClaimedLineKeysAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Untracked ledgers that finance may still put on a statement: at-finance or deferred, not
    /// excluded from batching, limited to the given tasks and optionally one assignee. Most
    /// recently updated first, capped at <paramref name="max"/>.
    /// </summary>
    Task<IReadOnlyList<InspectorFeeLedger>> ListBillableLedgersAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        string? assigneeId,
        int max,
        CancellationToken cancellationToken);

    /// <summary>
    /// Untracked open court-visit charges carrying an amount, excluding ids already on a
    /// statement, optionally for one credited assignee. Most recently updated first.
    /// </summary>
    Task<IReadOnlyList<CourtVisitFeeCharge>> ListOpenCourtVisitChargesAsync(
        string? creditAssigneeId,
        IReadOnlyCollection<Guid> excludedChargeIds,
        int max,
        CancellationToken cancellationToken);

    /// <summary>Tracked open court-visit charges among the given ids — the create path settles these.</summary>
    Task<IReadOnlyList<CourtVisitFeeCharge>> ListOpenCourtVisitChargesByIdsAsync(
        IReadOnlyCollection<Guid> chargeIds,
        CancellationToken cancellationToken);

    /// <summary>Court-visit charges by id, for mapping statement lines back to their charge.</summary>
    Task<IReadOnlyList<CourtVisitFeeCharge>> ListCourtVisitChargesByIdsAsync(
        IReadOnlyCollection<Guid> chargeIds,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>Untracked statements filtered by assignee, status, and the issued-or-later gate.</summary>
    Task<IReadOnlyList<PartyBillingStatement>> ListStatementsAsync(
        string? assigneeId,
        string? status,
        bool issuedOrLaterOnly,
        int max,
        CancellationToken cancellationToken);

    Task<PartyBillingStatement?> FindStatementAsync(
        Guid statementId,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>Untracked lines of several statements.</summary>
    Task<IReadOnlyList<PartyBillingStatementLine>> ListLinesForStatementsAsync(
        IReadOnlyCollection<Guid> statementIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PartyBillingStatementLine>> ListLinesForStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken);

    Task<int> CountLinesAsync(Guid statementId, CancellationToken cancellationToken);

    /// <summary>Line keys among <paramref name="lineKeys"/> that a statement already carries.</summary>
    Task<IReadOnlyList<Guid>> ListClaimedLineKeysAsync(
        IReadOnlyCollection<Guid> lineKeys,
        CancellationToken cancellationToken);

    /// <summary>Inspector-fee ledgers of the given workflow tasks.</summary>
    Task<IReadOnlyList<InspectorFeeLedger>> ListLedgersByTaskIdsAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tracked at-finance ledgers of one assignee that are not batched, not already on a
    /// statement, and not in <paramref name="selectedTaskIds"/> — the deferral candidates.
    /// </summary>
    Task<IReadOnlyList<InspectorFeeLedger>> ListUnselectedAtFinanceLedgersAsync(
        string? assigneeId,
        IReadOnlyCollection<Guid> selectedTaskIds,
        CancellationToken cancellationToken);

    /// <summary>True when another statement already carries this disbursement voucher.</summary>
    Task<bool> IsVoucherTakenAsync(
        Guid statementId,
        string? voucher,
        CancellationToken cancellationToken);

    /// <summary>
    /// Assignees among <paramref name="vendorIds"/> that already have a vendor statement in the
    /// open pipeline (draft / issued / invoice received) created on or after the month start.
    /// </summary>
    Task<IReadOnlyList<string>> ListVendorsWithOpenStatementsAsync(
        IReadOnlyCollection<string> vendorIds,
        DateTime monthStartUtc,
        CancellationToken cancellationToken);

    void AddStatement(PartyBillingStatement statement);

    void AddTransition(InspectorFeeTransition transition);

    /// <summary>
    /// Allocates the next yearly disbursement-slip reference. Returns the reference, or an
    /// Arabic error when the sequence could not be advanced.
    /// </summary>
    Task<(string? Reference, string? Error)> AllocateStatementReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
