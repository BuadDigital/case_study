using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed class EvaluatorRecallsService : IEvaluatorRecallsService
{
    private const int MaxListRows = 500;
    private readonly ValuationDbContext _db;
    private readonly TimeProvider _time;

    public EvaluatorRecallsService(ValuationDbContext db, TimeProvider? time = null)
    {
        _db = db;
        _time = time ?? TimeProvider.System;
    }

    public async Task<IReadOnlyList<EvaluatorRecallDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.EvaluatorRecallRecords.AsNoTracking()
            .OrderByDescending(x => x.RequestedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
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

        var now = _time.UtcNow();
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
        row.ResolvedAtUtc = _time.UtcNow();
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
        row.ResolvedAtUtc = _time.UtcNow();
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
