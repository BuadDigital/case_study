using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Financial.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IPartyFeePricingRepository"/>. Owns every pricing query, the
/// change-tracker peek the audit after-image needs, and the activation transaction.
/// </summary>
public sealed class PartyFeePricingRepository : IPartyFeePricingRepository
{
    private readonly FinancialDbContext _db;

    public PartyFeePricingRepository(FinancialDbContext db) => _db = db;

    public async Task<IReadOnlyList<PricingTableSummaryRow>> ListTableSummariesAsync(
        string? category,
        int max,
        CancellationToken cancellationToken)
    {
        var query = _db.PartyFeePricingTables.AsNoTracking();
        if (category is not null)
            query = query.Where(x => x.Category == category);

        return await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Select(x => new PricingTableSummaryRow(
                x.Id,
                x.Category,
                x.Name,
                x.PricingKind,
                x.ManagedBy,
                x.IsActive,
                x.UpdatedAtUtc))
            .Take(max)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, int>> CountAssignmentsByTableAsync(
        IReadOnlyCollection<Guid> tableIds,
        CancellationToken cancellationToken)
    {
        if (tableIds.Count == 0) return new Dictionary<Guid, int>();

        var counts = await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => tableIds.Contains(a.TableId))
            .GroupBy(a => a.TableId)
            .Select(g => new { TableId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return counts.ToDictionary(x => x.TableId, x => x.Count);
    }

    public Task<PartyFeePricingTable?> GetTableAsync(
        Guid id,
        bool track,
        CancellationToken cancellationToken)
    {
        IQueryable<PartyFeePricingTable> query =
            _db.PartyFeePricingTables.Include(x => x.AreaTiers);
        if (!track) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public Task<PartyFeePricingTable?> FindRateSourceTableAsync(
        string category,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category && x.PricingKind != PartyFeePricingKinds.Flat)
            .OrderByDescending(x => x.IsActive)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<PartyFeePricingTable?> FindFirstNonFlatTableByNameAsync(
        string category,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Category == category && x.PricingKind != PartyFeePricingKinds.Flat)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<PartyFeePricingTable?> FindActiveTableAsync(
        string category,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.AsNoTracking()
            .Include(x => x.AreaTiers)
            .FirstOrDefaultAsync(x => x.Category == category && x.IsActive, cancellationToken);

    public Task<PartyFeePricingTable?> FindFlatTableWithAmountAsync(
        string category,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.AsNoTracking()
            .Where(x =>
                x.Category == category
                && x.PricingKind == PartyFeePricingKinds.Flat
                && x.FlatAmountSar > 0m)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<PartyFeePricingTable>> ListActiveTablesInCategoryAsync(
        string category,
        Guid excludeTableId,
        CancellationToken cancellationToken) =>
        await _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Id != excludeTableId && x.Category == category && x.IsActive)
            .ToListAsync(cancellationToken);

    public Task<PartyFeePricingTable?> FindNextTableInCategoryAsync(
        string category,
        Guid excludeTableId,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables
            .Include(x => x.AreaTiers)
            .Where(x => x.Id != excludeTableId && x.Category == category)
            .OrderBy(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<bool> AnyTableInCategoryAsync(string category, CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.AnyAsync(x => x.Category == category, cancellationToken);

    public Task<bool> AnyActiveTableInCategoryAsync(
        string category,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.AsNoTracking()
            .AnyAsync(x => x.Category == category && x.IsActive, cancellationToken);

    public Task<int> CountTablesInCategoryAsync(string category, CancellationToken cancellationToken) =>
        _db.PartyFeePricingTables.CountAsync(x => x.Category == category, cancellationToken);

    public void AddTable(PartyFeePricingTable table) => _db.PartyFeePricingTables.Add(table);

    public void RemoveTable(PartyFeePricingTable table) => _db.PartyFeePricingTables.Remove(table);

    public Task<bool> AnyAssignmentsForTableAsync(Guid tableId, CancellationToken cancellationToken) =>
        _db.PartyFeePricingAssignments.AnyAsync(a => a.TableId == tableId, cancellationToken);

    public async Task<IReadOnlyList<string>> ListAssigneeIdsForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken) =>
        await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.TableId == tableId)
            .OrderBy(a => a.AssigneeId)
            .Select(a => a.AssigneeId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PricingAssignmentSnapshot>> ListAssignmentSnapshotsByCategoryAsync(
        string category,
        CancellationToken cancellationToken) =>
        await _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.Category == category)
            .OrderBy(a => a.TableId)
            .ThenBy(a => a.AssigneeId)
            .Select(a => new PricingAssignmentSnapshot(a.TableId, a.AssigneeId))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PartyFeePricingAssignment>> ListAssignmentsForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken) =>
        await _db.PartyFeePricingAssignments
            .Where(a => a.TableId == tableId)
            .OrderBy(a => a.AssigneeId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PartyFeePricingAssignment>> ListConflictingAssignmentsAsync(
        string category,
        Guid tableId,
        IReadOnlyCollection<string> assigneeIds,
        CancellationToken cancellationToken)
    {
        if (assigneeIds.Count == 0) return [];

        return await _db.PartyFeePricingAssignments
            .Where(a =>
                a.Category == category
                && a.TableId != tableId
                && assigneeIds.Contains(a.AssigneeId))
            .ToListAsync(cancellationToken);
    }

    public Task<Guid?> FindAssignedTableIdAsync(
        string category,
        string assigneeId,
        CancellationToken cancellationToken) =>
        _db.PartyFeePricingAssignments.AsNoTracking()
            .Where(a => a.Category == category && a.AssigneeId == assigneeId)
            .Select(a => (Guid?)a.TableId)
            .FirstOrDefaultAsync(cancellationToken);

    public void AddAssignment(PartyFeePricingAssignment assignment) =>
        _db.PartyFeePricingAssignments.Add(assignment);

    public void RemoveAssignments(IEnumerable<PartyFeePricingAssignment> assignments) =>
        _db.PartyFeePricingAssignments.RemoveRange(assignments);

    public async Task<IReadOnlyList<PartyFeePricingTier>> ListTiersForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken) =>
        await _db.PartyFeePricingTiers
            .Where(t => t.TableId == tableId)
            .ToListAsync(cancellationToken);

    public void RemoveTiers(IEnumerable<PartyFeePricingTier> tiers) =>
        _db.PartyFeePricingTiers.RemoveRange(tiers);

    public void AddTiers(IEnumerable<PartyFeePricingTier> tiers) =>
        _db.PartyFeePricingTiers.AddRange(tiers);

    public IReadOnlyList<PartyFeePricingTier> ListPendingTiers(Guid tableId) =>
        _db.ChangeTracker.Entries<PartyFeePricingTier>()
            .Where(e => e.Entity.TableId == tableId && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .OrderBy(t => t.SortOrder)
            .ToList();

    public void AddAuditLog(AuditLog log) => _db.Set<AuditLog>().Add(log);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _db.SaveChangesAsync(cancellationToken);

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync(_db, action, cancellationToken);
}
