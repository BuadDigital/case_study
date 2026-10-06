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

public sealed partial class EvaluatorRecallsService : IEvaluatorRecallsService
{
    private const int MaxListRows = 500;

    /// <summary>Error key for a transport failure toward Case Study — the controller answers 503.</summary>
    public const string UpstreamErrorKey = EvaluatorRecallDecisions.UpstreamErrorKey;

    public const string DepositedRecallMessageAr =
        "اعتمد المقيّم التقرير وجُمّد — يسحب اعتماده أولاً؛ وبعد تسجيل رمز الإيداع يُفتح بنسخة جديدة";

    public const string ReopenUnavailableMessageAr =
        "تعذّر إعادة فتح تقييم العقار الآن — لم يُسجَّل القرار ويمكن إعادة المحاولة";

    private readonly ValuationDbContext _db;
    private readonly ICaseStudyRecallCommands _caseStudy;
    private readonly TimeProvider _time;
    private readonly IValuationEventPublisher? _events;
    private readonly IValuationReportIssuanceService? _issuance;

    public EvaluatorRecallsService(
        ValuationDbContext db,
        ICaseStudyRecallCommands caseStudy,
        TimeProvider? time = null,
        IValuationEventPublisher? events = null,
        IValuationReportIssuanceService? issuance = null)
    {
        _db = db;
        _caseStudy = caseStudy;
        _time = time ?? TimeProvider.System;
        _events = events;
        _issuance = issuance;
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

        await NotifyAsync(
            existing.PropertyId,
            ValuationNoticeAudiences.CaseSpecialist,
            title: "طلب استرجاع تقرير التقييم",
            summary: "طلب المقيّم استرجاع تقرير التقييم للتعديل",
            note: existing.Reason,
            href: "/active-case-study",
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        return (ToDto(existing), null);
    }

    /// <summary>
    /// Valuation cannot address users — it publishes the notice and Platform resolves the
    /// audience to the property's open assignees. The publisher only stages the outbox row, so
    /// this runs before the save that commits the recall: both land together or not at all.
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
