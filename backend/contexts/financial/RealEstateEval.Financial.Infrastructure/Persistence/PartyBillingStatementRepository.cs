using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
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
        string? assigneeId,
        string? status,
        bool issuedOrLaterOnly,
        int max,
        CancellationToken cancellationToken)
    {
        var query = _db.PartyBillingStatements.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(assigneeId))
            query = query.Where(s => s.AssigneeId == assigneeId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        if (issuedOrLaterOnly)
        {
            query = query.Where(s =>
                s.Status == PartyBillingStatementStatus.Issued
                || s.Status == PartyBillingStatementStatus.InvoiceReceived
                || s.Status == PartyBillingStatementStatus.Closed);
        }

        return await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);
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
