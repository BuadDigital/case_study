using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IValuationComparableSelectionRepository"/>. The only place the
/// comparable-selection use case reaches <see cref="ValuationDbContext"/>.
/// </summary>
public sealed class ValuationComparableSelectionRepository(ValuationDbContext db)
    : IValuationComparableSelectionRepository
{
    public Task<ValuationRequest?> GetRequestAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);

    public Task EnsureBankSeedAsync(Guid valuationRequestId, CancellationToken cancellationToken) =>
        ComparableBankSeed.EnsureForValuationRequestAsync(db, valuationRequestId, cancellationToken);

    public async Task<IReadOnlyList<ValuationComparableSelection>> ListSelectionsAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken) =>
        await db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == selectionContext)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.SelectedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ValuationComparableSelection>> FindSelectionsAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken) =>
        await db.ValuationComparableSelections
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == selectionContext)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, ComparableProperty>> GetComparablesAsync(
        IReadOnlyCollection<Guid> comparableIds,
        CancellationToken cancellationToken)
    {
        if (comparableIds.Count == 0) return new Dictionary<Guid, ComparableProperty>();
        var ids = comparableIds.Distinct().ToList();
        return await db.ComparableProperties.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> ListActiveComparableIdsAsync(
        IReadOnlyCollection<Guid> comparableIds,
        CancellationToken cancellationToken)
    {
        if (comparableIds.Count == 0) return [];
        var ids = comparableIds.Distinct().ToList();
        return await db.ComparableProperties.AsNoTracking()
            .Where(c => ids.Contains(c.Id) && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);
    }

    public Task<ComparableProperty?> GetActiveComparableAsync(
        Guid comparablePropertyId,
        CancellationToken cancellationToken) =>
        db.ComparableProperties.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == comparablePropertyId && c.IsActive, cancellationToken);

    public Task<ValuationMarketApproach?> GetMarketApproachAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationMarketApproaches.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationMarketApproach?> FindMarketApproachAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationMarketApproaches
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<bool> MarketApproachExistsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationMarketApproaches
            .AnyAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task AddMarketApproachAsync(
        ValuationMarketApproach header,
        CancellationToken cancellationToken)
    {
        db.ValuationMarketApproaches.Add(header);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<ValuationAdjustmentFactorRationale>> ListFactorRationalesAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken) =>
        await db.ValuationAdjustmentFactorRationales.AsNoTracking()
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == selectionContext)
            .OrderBy(x => x.FactorKey)
            .ToListAsync(cancellationToken);

    public Task<ValuationAdjustmentFactorRationale?> FindFactorRationaleAsync(
        Guid valuationRequestId,
        string selectionContext,
        string factorKey,
        CancellationToken cancellationToken) =>
        db.ValuationAdjustmentFactorRationales
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId
                    && x.SelectionContext == selectionContext
                    && x.FactorKey == factorKey,
                cancellationToken);

    public Task AddFactorRationaleAsync(
        ValuationAdjustmentFactorRationale rationale,
        CancellationToken cancellationToken)
    {
        db.ValuationAdjustmentFactorRationales.Add(rationale);
        return Task.CompletedTask;
    }

    public Task RemoveFactorRationaleAsync(
        ValuationAdjustmentFactorRationale rationale,
        CancellationToken cancellationToken)
    {
        db.ValuationAdjustmentFactorRationales.Remove(rationale);
        return Task.CompletedTask;
    }

    public Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationComparableSelection?> FindSelectionByComparableAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        string selectionContext,
        bool includeLines,
        CancellationToken cancellationToken)
    {
        var q = db.ValuationComparableSelections.AsQueryable();
        if (includeLines) q = q.Include(x => x.AdjustmentLines);
        return q.FirstOrDefaultAsync(
            x => x.ValuationRequestId == valuationRequestId
                && x.ComparablePropertyId == comparablePropertyId
                && x.SelectionContext == selectionContext,
            cancellationToken);
    }

    public Task<ValuationComparableSelection?> FindSelectionAsync(
        Guid valuationRequestId,
        Guid selectionId,
        CancellationToken cancellationToken) =>
        db.ValuationComparableSelections
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(
                x => x.Id == selectionId && x.ValuationRequestId == valuationRequestId,
                cancellationToken);

    public Task<ValuationComparableSelection?> GetSelectionAsync(
        Guid selectionId,
        CancellationToken cancellationToken) =>
        db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(x => x.Id == selectionId, cancellationToken);

    public async Task<int> MaxSortOrderAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken) =>
        await db.ValuationComparableSelections
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == selectionContext)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

    public Task AddSelectionAsync(
        ValuationComparableSelection selection,
        CancellationToken cancellationToken)
    {
        db.ValuationComparableSelections.Add(selection);
        return Task.CompletedTask;
    }

    public Task RemoveSelectionAsync(
        ValuationComparableSelection selection,
        CancellationToken cancellationToken)
    {
        db.ValuationComparableSelections.Remove(selection);
        return Task.CompletedTask;
    }

    public Task RemoveSelectionsAsync(
        IReadOnlyCollection<ValuationComparableSelection> selections,
        CancellationToken cancellationToken)
    {
        db.ValuationComparableSelections.RemoveRange(selections);
        return Task.CompletedTask;
    }

    public Task AddAdjustmentLinesAsync(
        IReadOnlyCollection<ValuationComparableAdjustmentLine> lines,
        CancellationToken cancellationToken)
    {
        db.ValuationComparableAdjustmentLines.AddRange(lines);
        return Task.CompletedTask;
    }

    public Task RemoveAdjustmentLinesAsync(
        IReadOnlyCollection<ValuationComparableAdjustmentLine> lines,
        CancellationToken cancellationToken)
    {
        db.ValuationComparableAdjustmentLines.RemoveRange(lines);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Guid>> ListPropertyLinkedComparableIdsAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        await db.PropertyComparableLinks.AsNoTracking()
            .Where(x => x.PropertyId == propertyId)
            .OrderBy(x => x.LinkedAtUtc)
            .Select(x => x.ComparablePropertyId)
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
