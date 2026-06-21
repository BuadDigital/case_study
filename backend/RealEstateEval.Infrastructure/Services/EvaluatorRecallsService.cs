using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class EvaluatorRecallsService : IEvaluatorRecallsService
{
    private readonly ApplicationDbContext _db;

    public EvaluatorRecallsService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(
        string? status,
        CancellationToken cancellationToken = default)
    {
        var query = _db.EvaluatorRecallRecords.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status.Trim());

        var rows = await query.OrderByDescending(x => x.RequestedAtUtc).ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<EvaluatorRecallDto?> GetAsync(
        string taskId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.EvaluatorRecallRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TaskId == taskId, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<EvaluatorRecallDto> RequestAsync(
        CreateEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default)
    {
        var taskId = request.TaskId.Trim();
        var existing = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, cancellationToken);
        if (existing?.Status == EvaluatorRecallStatus.Pending)
            return ToDto(existing);

        var now = DateTime.UtcNow;
        if (existing is null)
        {
            existing = new EvaluatorRecallRecord
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                PoNumber = request.PoNumber.Trim(),
                PropertyId = request.PropertyId.Trim(),
                Status = EvaluatorRecallStatus.Pending,
                Reason = request.Reason?.Trim() ?? "",
                SpecialistNote = "",
                RequestedAtUtc = now,
            };
            _db.EvaluatorRecallRecords.Add(existing);
        }
        else
        {
            existing.PoNumber = request.PoNumber.Trim();
            existing.PropertyId = request.PropertyId.Trim();
            existing.Status = EvaluatorRecallStatus.Pending;
            existing.Reason = request.Reason?.Trim() ?? "";
            existing.SpecialistNote = "";
            existing.RequestedAtUtc = now;
            existing.ResolvedAtUtc = null;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(existing);
    }

    public async Task<EvaluatorRecallDto?> ApproveAsync(
        string taskId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, cancellationToken);
        if (row is null) return null;
        if (row.Status != EvaluatorRecallStatus.Pending) return ToDto(row);

        row.Status = EvaluatorRecallStatus.Approved;
        row.ResolvedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<EvaluatorRecallDto?> RejectAsync(
        string taskId,
        RejectEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, cancellationToken);
        if (row is null) return null;
        if (row.Status != EvaluatorRecallStatus.Pending) return ToDto(row);

        row.Status = EvaluatorRecallStatus.Rejected;
        row.SpecialistNote = request.SpecialistNote?.Trim() ?? "";
        row.ResolvedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    private static EvaluatorRecallDto ToDto(EvaluatorRecallRecord row) => new()
    {
        Id = row.Id,
        TaskId = row.TaskId,
        PoNumber = row.PoNumber,
        PropertyId = row.PropertyId,
        Status = row.Status,
        Reason = row.Reason,
        SpecialistNote = row.SpecialistNote,
        RequestedAtUtc = row.RequestedAtUtc,
        ResolvedAtUtc = row.ResolvedAtUtc,
    };
}
