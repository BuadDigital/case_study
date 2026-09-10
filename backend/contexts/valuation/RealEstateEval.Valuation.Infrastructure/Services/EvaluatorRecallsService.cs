using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed class EvaluatorRecallsService : IEvaluatorRecallsService
{
    private const int MaxListRows = 500;

    private readonly ValuationDbContext _db;
    private readonly TimeProvider _time;
    private readonly IValuationEventPublisher? _events;

    public EvaluatorRecallsService(
        ValuationDbContext db,
        TimeProvider? time = null,
        IValuationEventPublisher? events = null)
    {
        _db = db;
        _time = time ?? TimeProvider.System;
        _events = events;
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
        if (!TryParseId(taskId, out var id)) return null;
        var row = await _db.EvaluatorRecallRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TaskId == id, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<(EvaluatorRecallDto? Result, string? Error)> RequestAsync(
        CreateEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryParseId(request.TaskId, out var taskId))
            return (null, "معرّف المهمة غير صالح");
        if (!TryParseId(request.PropertyId, out var propertyId))
            return (null, "معرّف العقار غير صالح");

        var existing = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, cancellationToken);
        if (existing?.Status == EvaluatorRecallStatus.Pending)
            return (ToDto(existing), null);

        var now = _time.UtcNow();
        if (existing is null)
        {
            existing = new EvaluatorRecallRecord
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                PoNumber = request.PoNumber.Trim(),
                PropertyId = propertyId,
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
            existing.PropertyId = propertyId;
            existing.Status = EvaluatorRecallStatus.Pending;
            existing.Reason = request.Reason?.Trim() ?? "";
            existing.SpecialistNote = "";
            existing.RequestedAtUtc = now;
            existing.ResolvedAtUtc = null;
        }

        await _db.SaveChangesAsync(cancellationToken);

        await NotifyAsync(
            existing.PropertyId,
            ValuationNoticeAudiences.CaseSpecialist,
            title: "طلب استرجاع تقرير التقييم",
            summary: "طلب المقيّم استرجاع تقرير التقييم للتعديل",
            note: existing.Reason,
            href: "/active-case-study",
            cancellationToken);

        return (ToDto(existing), null);
    }

    public async Task<EvaluatorRecallDto?> ApproveAsync(
        string taskId,
        CancellationToken cancellationToken = default)
    {
        if (!TryParseId(taskId, out var id)) return null;
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == id, cancellationToken);
        if (row is null) return null;
        if (row.Status != EvaluatorRecallStatus.Pending) return ToDto(row);

        row.Status = EvaluatorRecallStatus.Approved;
        row.ResolvedAtUtc = _time.UtcNow();
        await _db.SaveChangesAsync(cancellationToken);

        // Approval hands the report back to the appraiser — the same shape as any other
        // «إعادة للتصحيح», so it carries the reason the recall was asked for.
        await NotifyAsync(
            row.PropertyId,
            ValuationNoticeAudiences.Appraiser,
            title: "قُبل استرجاع التقرير",
            summary: "وافق الأخصائي على استرجاع تقرير التقييم — التقرير عاد إليك للتعديل",
            note: row.Reason,
            href: $"/property-appraisal/{Uri.EscapeDataString(row.TaskId.ToString("D"))}",
            cancellationToken);

        return ToDto(row);
    }

    public async Task<EvaluatorRecallDto?> RejectAsync(
        string taskId,
        RejectEvaluatorRecallRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryParseId(taskId, out var id)) return null;
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == id, cancellationToken);
        if (row is null) return null;
        if (row.Status != EvaluatorRecallStatus.Pending) return ToDto(row);

        row.Status = EvaluatorRecallStatus.Rejected;
        row.SpecialistNote = request.SpecialistNote?.Trim() ?? "";
        row.ResolvedAtUtc = _time.UtcNow();
        await _db.SaveChangesAsync(cancellationToken);

        await NotifyAsync(
            row.PropertyId,
            ValuationNoticeAudiences.Appraiser,
            title: "رُفض استرجاع التقرير",
            summary: "رفض الأخصائي طلب استرجاع تقرير التقييم",
            note: row.SpecialistNote,
            href: $"/property-appraisal/{Uri.EscapeDataString(row.TaskId.ToString("D"))}",
            cancellationToken);

        return ToDto(row);
    }

    /// <summary>
    /// Valuation cannot address users — it publishes the notice and Platform resolves the
    /// audience to the property's open assignees. Best-effort: a recall is already committed.
    /// </summary>
    private async Task NotifyAsync(
        Guid propertyId,
        string audience,
        string title,
        string summary,
        string? note,
        string href,
        CancellationToken cancellationToken)
    {
        if (_events is null) return;

        var trimmed = (note ?? "").Trim();
        await _events.PublishAsync(
            IntegrationEventTypes.ValuationWorkflowNotice,
            new ValuationWorkflowNoticePayload(
                propertyId.ToString("D"),
                audience,
                title,
                trimmed.Length == 0 ? $"{summary}." : $"{summary}: {trimmed}",
                NotificationContract.Tones.Warn,
                href),
            cancellationToken);
    }

    /// <summary>Route and body ids arrive as text; the columns are uuids, so anything else matches nothing.</summary>
    private static bool TryParseId(string? text, out Guid id) =>
        Guid.TryParse(text?.Trim(), out id) && id != Guid.Empty;

    private static EvaluatorRecallDto ToDto(EvaluatorRecallRecord row) => new()
    {
        Id = row.Id,
        TaskId = row.TaskId.ToString("D"),
        PoNumber = row.PoNumber,
        PropertyId = row.PropertyId.ToString("D"),
        Status = row.Status,
        Reason = row.Reason,
        SpecialistNote = row.SpecialistNote,
        RequestedAtUtc = row.RequestedAtUtc,
        ResolvedAtUtc = row.ResolvedAtUtc,
    };
}
