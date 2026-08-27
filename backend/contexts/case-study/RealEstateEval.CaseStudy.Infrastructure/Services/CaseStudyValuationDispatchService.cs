using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class CaseStudyValuationDispatchService : ICaseStudyValuationDispatchService
{
    private readonly ICaseStudyRepository _db;
    private readonly IValuationRequestService _valuationRequests;
    private readonly IPropertyTimelineService _timeline;
    private readonly ILogger<CaseStudyValuationDispatchService> _logger;
    private readonly TimeProvider _time;

    public CaseStudyValuationDispatchService(
        ICaseStudyRepository db,
        IValuationRequestService valuationRequests,
        IPropertyTimelineService timeline,
        ILogger<CaseStudyValuationDispatchService> logger,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _valuationRequests = valuationRequests;
        _timeline = timeline;
        _logger = logger;
    }

    public async Task TryCreateWhenAppraisalSpawnedAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await CreateWhenAppraisalSpawnedCoreAsync(parentTaskId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "CaseStudyValuationDispatch: failed for task {TaskId} — preview/ensure will retry",
                parentTaskId);
        }
    }

    private async Task CreateWhenAppraisalSpawnedCoreAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken)
    {
        var parent = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == parentTaskId, cancellationToken);
        if (parent?.PropertyId is not Guid propertyId)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no linked property",
                parentTaskId);
            return;
        }

        var hasAppraisalChild = await _db.WorkflowTasks.AsNoTracking()
            .AnyAsync(
                t => t.ParentTaskId == parentTaskId
                     && t.Kind == WorkflowTaskKind.PropertyAppraisal,
                cancellationToken);
        if (!hasAppraisalChild)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: task {TaskId} has no valuation path",
                parentTaskId);
            return;
        }

        var propertyKey = propertyId.ToString("D");
        var appraisalTask = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId
                        && t.Kind == WorkflowTaskKind.PropertyAppraisal)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var alreadyOpen = await _valuationRequests.GetOpenByPropertyAsync(propertyKey, cancellationToken);
        if (alreadyOpen is not null)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: open valuation request already exists for property {PropertyId}",
                propertyId);
            await ReserveReportNumberOnAppraisalDraftAsync(
                appraisalTask,
                alreadyOpen,
                cancellationToken);
            return;
        }

        var property = await _db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

        var area = ResolveArea(property);
        var type = string.IsNullOrWhiteSpace(property?.PropertyType)
            ? "—"
            : property.PropertyType.Trim();
        var appraiser = string.IsNullOrWhiteSpace(appraisalTask?.AssigneeName)
            ? "—"
            : appraisalTask.AssigneeName.Trim();

        var (created, error) = await _valuationRequests.CreateAsync(
            new SaveValuationRequestRequest
            {
                PropId = propertyKey,
                Area = area,
                Type = type,
                Appraiser = appraiser,
                Status = ValuationRequestStatuses.Progress,
                Date = _time.UtcNow().ToString("yyyy-MM-dd"),
            },
            cancellationToken);

        if (created is null)
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: skipped for property {PropertyId} ({Error})",
                propertyId,
                error);
            created = await _valuationRequests.GetOpenByPropertyAsync(propertyKey, cancellationToken);
            if (created is null) return;
        }
        else
        {
            _logger.LogInformation(
                "CaseStudyValuationDispatch: created {DisplayId} for property {PropertyId} from task {TaskId}",
                created.DisplayId,
                propertyId,
                parentTaskId);

            await _timeline.RecordAsync(
                parent.PoNumber,
                propertyId,
                $"valuation-request:{created.Id}:created",
                "فتح مسار التقييم",
                appraiser,
                "done",
                _time.UtcNow(),
                cancellationToken);
        }

        await ReserveReportNumberOnAppraisalDraftAsync(
            appraisalTask,
            created,
            cancellationToken);
    }

    private async Task ReserveReportNumberOnAppraisalDraftAsync(
        WorkflowTask? appraisalTask,
        ValuationRequestDto request,
        CancellationToken cancellationToken)
    {
        if (appraisalTask is null) return;

        var reservedDate = DateOnly.TryParse(request.Date, out var parsed)
            ? parsed
            : DateOnly.FromDateTime(_time.UtcNow());
        var reportNo = FormatReservedReportNumber(request.DisplayId, reservedDate);

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == appraisalTask.Id, cancellationToken);
        var now = _time.UtcNow();
        if (entity is null)
        {
            entity = new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = appraisalTask.Id,
                Kind = WorkflowTaskKindValues.PropertyAppraisal,
                PropertyId = appraisalTask.PropertyId,
                PoNumber = appraisalTask.PoNumber,
                Status = PartyTaskSubmissionStatus.Draft,
                PayloadJson = SeedAppraisalPayload(appraisalTask, reportNo),
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };
            _db.PartyTaskSubmissions.Add(entity);
        }
        else
        {
            entity.PayloadJson = MergeReportNo(entity.PayloadJson, reportNo, appraisalTask);
            entity.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation(
            "CaseStudyValuationDispatch: reserved {ReportNo} on appraisal task {TaskId}",
            reportNo,
            appraisalTask.Id);
    }

    private static string SeedAppraisalPayload(WorkflowTask appraisalTask, string reportNo)
    {
        var payload = new Dictionary<string, object?>
        {
            ["taskId"] = appraisalTask.Id.ToString("D"),
            ["propertyId"] = appraisalTask.PropertyId?.ToString("D") ?? "",
            ["poNumber"] = appraisalTask.PoNumber ?? "",
            ["status"] = PartyTaskSubmissionStatus.Draft,
            ["reportNo"] = reportNo,
        };
        return JsonSerializer.Serialize(payload);
    }

    private static string MergeReportNo(string payloadJson, string reportNo, WorkflowTask appraisalTask)
    {
        try
        {
            using var doc = JsonDocument.Parse(
                string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return SeedAppraisalPayload(appraisalTask, reportNo);

            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream))
            {
                writer.WriteStartObject();
                var wroteReportNo = false;
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("reportNo"))
                    {
                        wroteReportNo = true;
                        var existing = prop.Value.ValueKind == JsonValueKind.String
                            ? prop.Value.GetString()
                            : null;
                        writer.WriteString(
                            "reportNo",
                            string.IsNullOrWhiteSpace(existing) ? reportNo : existing.Trim());
                    }
                    else
                    {
                        prop.WriteTo(writer);
                    }
                }

                if (!wroteReportNo)
                    writer.WriteString("reportNo", reportNo);

                writer.WriteEndObject();
            }

            return Encoding.UTF8.GetString(stream.ToArray());
        }
        catch (JsonException)
        {
            return SeedAppraisalPayload(appraisalTask, reportNo);
        }
    }

    private static string ResolveArea(WorkOrderProperty? property)
    {
        if (property is null) return "—";
        if (!string.IsNullOrWhiteSpace(property.City))
            return property.City.Trim();
        if (!string.IsNullOrWhiteSpace(property.District))
            return property.District.Trim();
        return "—";
    }

    /// <summary>Must stay aligned with <c>ValuationReportNumberRules.FormatReserved</c>.</summary>
    private static string FormatReservedReportNumber(string displayId, DateOnly reservedDate)
    {
        var digits = new string((displayId ?? "").Where(char.IsDigit).ToArray());
        var ordinal = int.TryParse(digits, out var n) && n > 0 ? n : 1;
        return $"TQ{reservedDate:yyyyMMdd}{ordinal:D4}";
    }
}
