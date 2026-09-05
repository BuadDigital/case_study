using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Financial.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IPartyBillingStatementRepository"/>. Owns every statement query,
/// the ledger and court-visit reads a statement settles, and the reference-sequence allocation.
/// </summary>
public sealed class PartyBillingStatementRepository : IPartyBillingStatementRepository
{
    private readonly FinancialDbContext _db;

    public PartyBillingStatementRepository(FinancialDbContext db) => _db = db;

    public async Task<IReadOnlySet<Guid>> ListClaimedLineKeysAsync(CancellationToken cancellationToken)
    {
        var keys = await _db.PartyBillingStatementLines.AsNoTracking()
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);
        return keys.ToHashSet();
    }

    public async Task<IReadOnlyList<Guid>> ListClaimedLineKeysAsync(
        IReadOnlyCollection<Guid> lineKeys,
        CancellationToken cancellationToken)
    {
        if (lineKeys.Count == 0) return [];

        return await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => lineKeys.Contains(l.WorkflowTaskId))
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListBillableLedgersAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        string? assigneeId,
        int max,
        CancellationToken cancellationToken)
    {
        if (workflowTaskIds.Count == 0) return [];

        return await _db.InspectorFeeLedgers.AsNoTracking()
            .Where(ledger =>
                workflowTaskIds.Contains(ledger.WorkflowTaskId)
                && !ledger.ExcludedFromBatch
                && (ledger.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    || ledger.BillingStatus == InspectorFeeBillingStatus.Deferred)
                && (assigneeId == null || ledger.AssigneeId == assigneeId))
            .OrderByDescending(ledger => ledger.UpdatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeCharge>> ListOpenCourtVisitChargesAsync(
        string? creditAssigneeId,
        IReadOnlyCollection<Guid> excludedChargeIds,
        int max,
        CancellationToken cancellationToken)
    {
        var query = _db.CourtVisitFeeCharges.AsNoTracking()
            .Where(c => c.Status == CourtVisitFeeStatuses.Open
                && c.AmountSar > 0
                && !excludedChargeIds.Contains(c.Id));

        if (!string.IsNullOrWhiteSpace(creditAssigneeId))
        {
            var aid = creditAssigneeId.Trim();
            query = query.Where(c => c.CreditAssigneeId == aid);
        }

        return await query
            .OrderByDescending(c => c.UpdatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeCharge>> ListOpenCourtVisitChargesByIdsAsync(
        IReadOnlyCollection<Guid> chargeIds,
        CancellationToken cancellationToken)
    {
        if (chargeIds.Count == 0) return [];

        return await _db.CourtVisitFeeCharges
            .Where(c => chargeIds.Contains(c.Id)
                && c.Status == CourtVisitFeeStatuses.Open
                && c.AmountSar > 0)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeCharge>> ListCourtVisitChargesByIdsAsync(
        IReadOnlyCollection<Guid> chargeIds,
        bool track,
        CancellationToken cancellationToken)
    {
        if (chargeIds.Count == 0) return [];

        IQueryable<CourtVisitFeeCharge> query = _db.CourtVisitFeeCharges;
        if (!track) query = query.AsNoTracking();

        return await query
            .Where(c => chargeIds.Contains(c.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PartyBillingStatement>> ListStatementsAsync(
        PartyBillingStatementListFilterQuery filter,
        PartyBillingStatementListSortKey sort,
        bool descending,
        int skip,
        int take,
        CancellationToken cancellationToken) =>
        await SortStatements(FilterStatements(filter), sort, descending)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<int> CountStatementsAsync(
        PartyBillingStatementListFilterQuery filter,
        CancellationToken cancellationToken) =>
        FilterStatements(filter).CountAsync(cancellationToken);

    /// <summary>Every clause is an EF predicate — pagination-contract §9.1.</summary>
    private IQueryable<PartyBillingStatement> FilterStatements(PartyBillingStatementListFilterQuery filter)
    {
        var query = _db.PartyBillingStatements.AsNoTracking().AsQueryable();

        if (filter.AssigneeId is not null)
            query = query.Where(s => s.AssigneeId == filter.AssigneeId);

        if (filter.Statuses is not null)
        {
            // An empty list is a status filter that recognised none of its tokens: it matches
            // no row, exactly as the old exact-match filter did for a typo.
            var statuses = filter.Statuses.ToList();
            query = statuses.Count == 0
                ? query.Where(s => false)
                : query.Where(s => statuses.Contains(s.Status));
        }

        if (filter.IssuedOrLaterOnly)
        {
            query = query.Where(s =>
                s.Status == PartyBillingStatementStatus.Issued
                || s.Status == PartyBillingStatementStatus.InvoiceReceived
                || s.Status == PartyBillingStatementStatus.Closed);
        }

        if (filter.Search is not null)
        {
            var q = filter.Search;
            query = query.Where(s =>
                s.ReferenceNumber.Contains(q)
                || (s.VendorInvoiceNumber != null && s.VendorInvoiceNumber.Contains(q))
                || (s.DisbursementVoucher != null && s.DisbursementVoucher.Contains(q))
                || (s.TransferReference != null && s.TransferReference.Contains(q)));
        }

        return query;
    }

    private static IOrderedQueryable<PartyBillingStatement> SortStatements(
        IQueryable<PartyBillingStatement> query,
        PartyBillingStatementListSortKey sort,
        bool descending)
    {
        IOrderedQueryable<PartyBillingStatement> ordered = sort switch
        {
            PartyBillingStatementListSortKey.Issued => descending
                ? query.OrderByDescending(s => s.IssuedAtUtc)
                : query.OrderBy(s => s.IssuedAtUtc),
            PartyBillingStatementListSortKey.Closed => descending
                ? query.OrderByDescending(s => s.ClosedAtUtc)
                : query.OrderBy(s => s.ClosedAtUtc),
            PartyBillingStatementListSortKey.Reference => descending
                ? query.OrderByDescending(s => s.ReferenceNumber)
                : query.OrderBy(s => s.ReferenceNumber),
            PartyBillingStatementListSortKey.TotalNet => descending
                ? query.OrderByDescending(s => s.TotalNetSar)
                : query.OrderBy(s => s.TotalNetSar),
            _ => descending
                ? query.OrderByDescending(s => s.CreatedAtUtc)
                : query.OrderBy(s => s.CreatedAtUtc),
        };

        return ordered.ThenBy(s => s.Id);
    }

    public Task<PartyBillingStatement?> FindStatementAsync(
        Guid statementId,
        bool track,
        CancellationToken cancellationToken)
    {
        IQueryable<PartyBillingStatement> query = _db.PartyBillingStatements;
        if (!track) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
    }

    public async Task<IReadOnlyList<PartyBillingStatementLine>> ListLinesForStatementsAsync(
        IReadOnlyCollection<Guid> statementIds,
        CancellationToken cancellationToken)
    {
        if (statementIds.Count == 0) return [];

        return await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => statementIds.Contains(l.StatementId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PartyBillingStatementLine>> ListLinesForStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken) =>
        await _db.PartyBillingStatementLines
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);

    public Task<int> CountLinesAsync(Guid statementId, CancellationToken cancellationToken) =>
        _db.PartyBillingStatementLines.CountAsync(l => l.StatementId == statementId, cancellationToken);

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListLedgersByTaskIdsAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        bool track,
        CancellationToken cancellationToken)
    {
        if (workflowTaskIds.Count == 0) return [];

        IQueryable<InspectorFeeLedger> query = _db.InspectorFeeLedgers;
        if (!track) query = query.AsNoTracking();

        return await query
            .Where(l => workflowTaskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListUnselectedAtFinanceLedgersAsync(
        string? assigneeId,
        IReadOnlyCollection<Guid> selectedTaskIds,
        CancellationToken cancellationToken) =>
        await _db.InspectorFeeLedgers
            .Where(l =>
                l.AssigneeId == assigneeId
                && l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                && !l.ExcludedFromBatch
                && !selectedTaskIds.Contains(l.WorkflowTaskId)
                && !l.PartyBillingStatementId.HasValue)
            .ToListAsync(cancellationToken);

    public Task<bool> IsVoucherTakenAsync(
        Guid statementId,
        string? voucher,
        CancellationToken cancellationToken) =>
        _db.PartyBillingStatements.AsNoTracking().AnyAsync(
            s => s.Id != statementId
                && s.DisbursementVoucher != null
                && s.DisbursementVoucher == voucher,
            cancellationToken);

    public async Task<IReadOnlyList<string>> ListVendorsWithOpenStatementsAsync(
        IReadOnlyCollection<string> vendorIds,
        DateTime monthStartUtc,
        CancellationToken cancellationToken)
    {
        if (vendorIds.Count == 0) return [];

        return await _db.PartyBillingStatements.AsNoTracking()
            .Where(s =>
                s.AssigneeId != null
                && vendorIds.Contains(s.AssigneeId)
                && s.PayeeType == PartyBillingPayeeType.Vendor
                && s.CreatedAtUtc >= monthStartUtc
                && (s.Status == PartyBillingStatementStatus.Draft
                    || s.Status == PartyBillingStatementStatus.Issued
                    || s.Status == PartyBillingStatementStatus.InvoiceReceived))
            .Select(s => s.AssigneeId!)
            .ToListAsync(cancellationToken);
    }

    public void AddStatement(PartyBillingStatement statement) =>
        _db.PartyBillingStatements.Add(statement);

    public void AddTransition(InspectorFeeTransition transition) =>
        _db.InspectorFeeTransitions.Add(transition);

    public Task<(string? Reference, string? Error)> AllocateStatementReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            _db,
            DatabaseSchemas.Financial,
            ReferenceNumbering.DisbursementStatement,
            nowUtc,
            cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _db.SaveChangesAsync(cancellationToken);
}
