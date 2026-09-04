using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

namespace RealEstateEval.Operations.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IKeyEnvelopeRepository"/>. The only place the key-envelope use
/// cases reach <see cref="OperationsDbContext"/>.
/// </summary>
public sealed class KeyEnvelopeRepository(OperationsDbContext ops) : IKeyEnvelopeRepository
{
    public async Task<IReadOnlyList<KeyEnvelope>> ListRecentAsync(
        int max,
        CancellationToken cancellationToken) =>
        await WithDetails()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);

    public Task<KeyEnvelope?> GetWithDetailsAsync(Guid id, CancellationToken cancellationToken) =>
        WithDetails().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<KeyEnvelope?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        ops.KeyEnvelopes.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<KeyEnvelope?> FindWithAssignmentsAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        ops.KeyEnvelopes
            .Include(x => x.Assignments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<KeyEnvelope?> FindWithChildrenAsync(Guid id, CancellationToken cancellationToken) =>
        ops.KeyEnvelopes
            .Include(e => e.Assignments)
            .Include(e => e.Handoffs)
            .Include(e => e.Timeline)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public Task AddAsync(KeyEnvelope envelope, CancellationToken cancellationToken)
    {
        ops.KeyEnvelopes.Add(envelope);
        return Task.CompletedTask;
    }

    public Task RemoveAsync(KeyEnvelope envelope, CancellationToken cancellationToken)
    {
        ops.KeyEnvelopes.Remove(envelope);
        return Task.CompletedTask;
    }

    public Task AddHandoffAsync(KeyEnvelopeHandoff handoff, CancellationToken cancellationToken)
    {
        ops.KeyEnvelopeHandoffs.Add(handoff);
        return Task.CompletedTask;
    }

    public Task<KeyEnvelopeHandoff?> FindHandoffAsync(
        Guid envelopeId,
        Guid handoffId,
        CancellationToken cancellationToken) =>
        ops.KeyEnvelopeHandoffs
            .FirstOrDefaultAsync(h => h.Id == handoffId && h.EnvelopeId == envelopeId, cancellationToken);

    public Task AddTimelineEntryAsync(
        KeyEnvelopeTimelineEntry entry,
        CancellationToken cancellationToken)
    {
        ops.KeyEnvelopeTimelineEntries.Add(entry);
        return Task.CompletedTask;
    }

    public Task<(string? Reference, string? Error)> AllocateReferenceNumberAsync(
        DateTime utcNow,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            ops,
            DatabaseSchemas.Operations,
            ReferenceNumbering.KeyEnvelope,
            utcNow,
            cancellationToken);

    public async Task<IReadOnlyList<KeyEnvelope>> ListRevenueEntitlementsAsync(
        int max,
        CancellationToken cancellationToken) =>
        await ops.KeyEnvelopes.AsNoTracking()
            .Where(x => x.RevenueEntitlementAtUtc != null
                || (x.FeeGenerated && x.FeeAmountSar != null))
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(max)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<KeyEnvelope>> ListByIdsAsync(
        IReadOnlyCollection<Guid> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];
        var wanted = ids.Distinct().ToList();
        return await ops.KeyEnvelopes.AsNoTracking()
            .Where(e => wanted.Contains(e.Id))
            .ToListAsync(cancellationToken);
    }

    public Task<bool> HasRevenueEntitlementAsync(
        Guid envelopeId,
        CancellationToken cancellationToken) =>
        ops.KeyEnvelopes.AsNoTracking()
            .AnyAsync(e => e.Id == envelopeId && e.RevenueEntitlementAtUtc != null, cancellationToken);

    public async Task<IReadOnlyList<PropertyCourtAccess>> ListCourtAccessAsync(
        string? requestNumber,
        CancellationToken cancellationToken)
    {
        var query = ops.PropertyCourtAccesses.AsNoTracking().AsQueryable();
        var key = requestNumber?.Trim();
        if (!string.IsNullOrEmpty(key))
            query = query.Where(x => x.RequestNumber == key);

        return await query
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<PropertyCourtAccess?> FindCourtAccessAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        ops.PropertyCourtAccesses
            .FirstOrDefaultAsync(x => x.PropertyId == propertyId, cancellationToken);

    public Task<PropertyCourtAccess?> GetCourtAccessAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        ops.PropertyCourtAccesses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PropertyId == propertyId, cancellationToken);

    public Task AddCourtAccessAsync(PropertyCourtAccess access, CancellationToken cancellationToken)
    {
        ops.PropertyCourtAccesses.Add(access);
        return Task.CompletedTask;
    }

    public Task<CourtVisitTaskFacts?> FindCourtVisitTaskFactsAsync(
        Guid taskId,
        CancellationToken cancellationToken) =>
        ops.OperationsTasks.AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => new CourtVisitTaskFacts(t.Type, t.Status, t.CourtVisitResultJson))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task SaveAndDetachAsync(CancellationToken cancellationToken)
    {
        await ops.SaveChangesAsync(cancellationToken);
        ops.ChangeTracker.Clear();
    }

    private IQueryable<KeyEnvelope> WithDetails() =>
        ops.KeyEnvelopes.AsNoTracking()
            .Include(x => x.Assignments)
            .Include(x => x.Handoffs)
            .Include(x => x.Timeline);
}
