using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IPoEnfazBillingRepository"/>. Owns every Enfaz billing query
/// over revenue lines, invoices, finance flags, and follow-ups.
/// </summary>
public sealed class PoEnfazBillingRepository : IPoEnfazBillingRepository
{
    private readonly FinancialDbContext _db;

    public PoEnfazBillingRepository(FinancialDbContext db) => _db = db;

    public async Task<IReadOnlyList<PoEnfazRevenueLine>> ListRevenueLinesAsync(
        string poNumber,
        IReadOnlyCollection<Guid> propertyIds,
        bool track,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0) return [];

        IQueryable<PoEnfazRevenueLine> query = _db.PoEnfazRevenueLines;
        if (!track) query = query.AsNoTracking();

        return await query
            .Where(x => x.PoNumber == poNumber && propertyIds.Contains(x.PropertyId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PoEnfazRevenueLine>> ListRevenueLinesForPosAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken)
    {
        if (poNumbers.Count == 0) return [];

        return await _db.PoEnfazRevenueLines.AsNoTracking()
            .Where(x => poNumbers.Contains(x.PoNumber))
            .ToListAsync(cancellationToken);
    }

    public Task<PoEnfazRevenueLine?> FindRevenueLineAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken) =>
        _db.PoEnfazRevenueLines.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.PoNumber == poNumber && x.PropertyId == propertyId,
                cancellationToken);

    public void AddRevenueLine(PoEnfazRevenueLine line) => _db.PoEnfazRevenueLines.Add(line);

    public Task<PoEnfazInvoice?> FindInvoiceAsync(
        string poNumber,
        bool track,
        CancellationToken cancellationToken)
    {
        IQueryable<PoEnfazInvoice> query = _db.PoEnfazInvoices;
        if (!track) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(x => x.PoNumber == poNumber, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, PoEnfazInvoice>> ListInvoicesByPoAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken)
    {
        if (poNumbers.Count == 0) return new Dictionary<string, PoEnfazInvoice>(StringComparer.Ordinal);

        return await _db.PoEnfazInvoices.AsNoTracking()
            .Where(x => poNumbers.Contains(x.PoNumber))
            .ToDictionaryAsync(x => x.PoNumber.Trim(), StringComparer.Ordinal, cancellationToken);
    }

    public async Task<IReadOnlyList<PoEnfazInvoice>> ListOutstandingInvoicesAsync(
        CancellationToken cancellationToken) =>
        await _db.PoEnfazInvoices.AsNoTracking()
            .Where(i => i.Status != PoEnfazInvoiceStatus.Collected
                && i.CollectedAmountSar + 0.009m < i.TotalSar)
            .OrderBy(i => i.IssuedAtUtc)
            .ThenBy(i => i.PoNumber)
            .ToListAsync(cancellationToken);

    public void AddInvoice(PoEnfazInvoice invoice) => _db.PoEnfazInvoices.Add(invoice);

    public async Task<IReadOnlyList<PoEnfazFinanceFlag>> ListFinanceFlagsAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken)
    {
        if (poNumbers.Count == 0) return [];

        return await _db.PoEnfazFinanceFlags.AsNoTracking()
            .Where(f => poNumbers.Contains(f.PoNumber))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PoEnfazFinanceFlag>> ListFinanceFlagsForPoAsync(
        string poNumber,
        CancellationToken cancellationToken) =>
        await _db.PoEnfazFinanceFlags
            .Where(f => f.PoNumber == poNumber)
            .ToListAsync(cancellationToken);

    public void AddFinanceFlag(PoEnfazFinanceFlag flag) => _db.PoEnfazFinanceFlags.Add(flag);

    public void RemoveFinanceFlags(IEnumerable<PoEnfazFinanceFlag> flags) =>
        _db.PoEnfazFinanceFlags.RemoveRange(flags);

    public async Task<IReadOnlyList<PoEnfazFollowup>> ListFollowupsAsync(
        string poNumber,
        int max,
        CancellationToken cancellationToken) =>
        await _db.PoEnfazFollowups.AsNoTracking()
            .Where(f => f.PoNumber == poNumber)
            .OrderByDescending(f => f.FollowedAtUtc)
            .ThenByDescending(f => f.CreatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<string, int>> CountFollowupsByPoAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken)
    {
        if (poNumbers.Count == 0) return new Dictionary<string, int>(StringComparer.Ordinal);

        var counts = await _db.PoEnfazFollowups.AsNoTracking()
            .Where(f => poNumbers.Contains(f.PoNumber))
            .GroupBy(f => f.PoNumber)
            .Select(g => new { PoNumber = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return counts.ToDictionary(x => x.PoNumber.Trim(), x => x.Count, StringComparer.Ordinal);
    }

    public void AddFollowup(PoEnfazFollowup followup) => _db.PoEnfazFollowups.Add(followup);

    public void AddAuditLog(AuditLog log) => _db.AuditLogs.Add(log);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _db.SaveChangesAsync(cancellationToken);
}
