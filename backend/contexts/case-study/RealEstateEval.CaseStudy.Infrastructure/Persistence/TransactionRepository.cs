using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class TransactionRepository(CaseStudyDbContext db) : ITransactionRepository
{
    public Task<(string? Number, string? Error)> AllocateDraftNumberAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            db,
            DatabaseSchemas.CaseStudy,
            ReferenceNumbering.TransactionDraft,
            nowUtc,
            cancellationToken);

    // Decision 2026-10-19: the official number draws from the property (PR) sequence; PRC / PRV reuse its root.
    public Task<(string? Reference, string? Error)> AllocateOfficialReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            db,
            DatabaseSchemas.CaseStudy,
            ReferenceNumbering.Property,
            nowUtc,
            cancellationToken);

    public async Task<Transaction?> GetByPropertyAsync(
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken)
    {
        IQueryable<Transaction> query = db.Transactions.Include(t => t.Properties);
        if (!track) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(
            t => t.Properties.Any(p => p.Id == propertyId),
            cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
