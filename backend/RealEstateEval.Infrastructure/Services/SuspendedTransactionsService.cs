using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class SuspendedTransactionsService : ISuspendedTransactionsService
{
    private readonly ApplicationDbContext _db;

    public SuspendedTransactionsService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<SuspendedTransactionDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.PropertyFailures.AsNoTracking()
            .Where(x => x.Status == PropertyFailureStatus.Suspended)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        var names = await PersonLabelResolver.ResolveManyAsync(
            _db,
            rows.Select(x => x.Specialist),
            cancellationToken);

        return rows.Select(x => new SuspendedTransactionDto
        {
            Id = x.Id,
            PoNumber = x.PoNumber,
            PropertyId = x.PropertyId,
            FailureId = x.Id.ToString(),
            DeedNumber = x.DeedNumber,
            Title = x.Title,
            InternalNote = x.InternalNote,
            RaisedByRole = PersonLabelResolver.NormalizeSystemLabel(x.RaisedByRole),
            Specialist = PersonLabelResolver.ApplyResolved(x.Specialist, names),
            SupervisorNote = x.FinalNote,
            SuspendedAt = x.UpdatedAtUtc,
            SuspendedBy = PersonLabelResolver.NormalizeSystemLabel(x.RaisedByRole),
        }).ToList();
    }
}
