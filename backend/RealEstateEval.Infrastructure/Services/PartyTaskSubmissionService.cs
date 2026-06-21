using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public class PartyTaskSubmissionService : IPartyTaskSubmissionService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static readonly HashSet<string> AllowedKinds =
    [
        "engineering-survey",
        "property-appraisal",
        "government-review",
        "valuation-coordination",
        "field-inspection",
    ];

    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskService _tasks;

    public PartyTaskSubmissionService(ApplicationDbContext db, IWorkflowTaskService tasks)
    {
        _db = db;
        _tasks = tasks;
    }

    public async Task<PartyTaskSubmissionDto?> GetAsync(
        Guid taskId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is not null && entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل إرسال مُكتمل" });

        var now = DateTime.UtcNow;
        if (entity is null)
        {
            entity = new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = taskId,
                Kind = task.Kind,
                PropertyId = task.PropertyId,
                PoNumber = task.PoNumber,
                CreatedAtUtc = now,
            };
            _db.PartyTaskSubmissions.Add(entity);
        }

        var payloadJson = request.Payload.ValueKind == JsonValueKind.Undefined
            ? entity.PayloadJson
            : request.Payload.GetRawText();

        var status = ExtractStatus(payloadJson) ?? entity.Status;
        if (status is PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "استخدم نقطة الإرسال لتقديم العمل" });

        entity.PayloadJson = payloadJson;
        entity.Status = status is PartyTaskSubmissionStatus.Reopened
            ? PartyTaskSubmissionStatus.Reopened
            : PartyTaskSubmissionStatus.Draft;
        entity.PropertyId = task.PropertyId;
        entity.PoNumber = task.PoNumber;
        entity.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد مسودة للإرسال" });

        if (entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (ToDto(entity), null);

        var validationErrors = ValidateForSubmit(entity);
        if (validationErrors.Count > 0)
            return (null, validationErrors);

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Submitted;
        entity.SubmittedAtUtc = now;
        entity.UpdatedAtUtc = now;
        entity.PayloadJson = SetPayloadStatus(entity.PayloadJson, PartyTaskSubmissionStatus.Submitted, now);

        await _db.SaveChangesAsync(cancellationToken);

        await _tasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatus.Completed, Phase = "done" },
            cancellationToken);

        return (ToDto(entity), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (task.Kind is not ("engineering-survey" or "property-appraisal"))
            return (null, new Dictionary<string, string> { ["_"] = "إعادة الفتح غير مدعومة لهذا النوع" });

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if (task.Kind == "engineering-survey" && string.IsNullOrWhiteSpace(returnNote))
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مُكتمل لإعادته" });

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Reopened;
        entity.ReturnNote = returnNote;
        entity.SubmittedAtUtc = null;
        entity.UpdatedAtUtc = now;
        entity.PayloadJson = SetPayloadReopened(entity.PayloadJson, returnNote, now);

        await _db.SaveChangesAsync(cancellationToken);

        await _tasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatus.Open, Phase = "done" },
            cancellationToken);

        return (ToDto(entity), null);
    }

    private static Dictionary<string, string> ValidateForSubmit(PartyTaskSubmission entity)
    {
        var errors = new Dictionary<string, string>();
        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            var root = doc.RootElement;

            switch (entity.Kind)
            {
                case "engineering-survey":
                    if (!HasNonEmpty(root, "latitude") || !HasNonEmpty(root, "longitude"))
                        errors["coordinates"] = "الإحداثيات مطلوبة";
                    if (!HasNonEmpty(root, "surveyReportFileName"))
                        errors["surveyReportFileName"] = "تقرير الرفع المساحي مطلوب";
                    if (!HasNonEmpty(root, "siteLetterFileName"))
                        errors["siteLetterFileName"] = "خطاب الموقع مطلوب";
                    if (!GetBool(root, "siteConfirmed"))
                        errors["siteConfirmed"] = "يجب تأكيد الموقع";
                    break;

                case "property-appraisal":
                    if (!HasNonEmpty(root, "evaluatorPrice"))
                        errors["evaluatorPrice"] = "سعر التقييم مطلوب";
                    if (!HasNonEmpty(root, "reportFileName"))
                        errors["reportFileName"] = "تقرير PDF مطلوب";
                    break;

                case "government-review":
                    if (!HasNonEmpty(root, "visitStatus"))
                        errors["visitStatus"] = "حالة الزيارة مطلوبة";
                    if (!GetBool(root, "confirmed"))
                        errors["confirmed"] = "يجب تأكيد صحة البيانات";
                    break;

                case "valuation-coordination":
                    if (!GetBool(root, "receiptConfirmed"))
                        errors["receiptConfirmed"] = "يجب تأكيد الاستلام";
                    break;

                case "field-inspection":
                    if (!HasNonEmpty(root, "propertyType"))
                        errors["propertyType"] = "نوع العقار مطلوب";
                    break;
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    private static bool HasNonEmpty(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind switch
        {
            JsonValueKind.String => !string.IsNullOrWhiteSpace(prop.GetString()),
            JsonValueKind.Number => true,
            JsonValueKind.True => true,
            _ => false,
        };
    }

    private static bool GetBool(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind == JsonValueKind.True;
    }

    private static string? ExtractStatus(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("status", out var status))
                return status.GetString();
        }
        catch
        {
            // ignore
        }

        return null;
    }

    private static string SetPayloadStatus(string payloadJson, string status, DateTime submittedAt)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = status;
            mutable["submittedAtUtc"] = submittedAt.ToString("O");
            mutable["updatedAtUtc"] = submittedAt.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    private static string SetPayloadReopened(string payloadJson, string returnNote, DateTime now)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = PartyTaskSubmissionStatus.Reopened;
            mutable["returnNote"] = returnNote;
            mutable["submittedAtUtc"] = null;
            mutable["updatedAtUtc"] = now.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    private static object? DeserializeElement(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => JsonSerializer.Deserialize<object>(element.GetRawText(), JsonOpts),
        };

    private static PartyTaskSubmissionDto ToDto(PartyTaskSubmission entity)
    {
        JsonElement payload;
        try
        {
            payload = JsonDocument.Parse(entity.PayloadJson).RootElement.Clone();
        }
        catch
        {
            payload = JsonDocument.Parse("{}").RootElement.Clone();
        }

        return new PartyTaskSubmissionDto
        {
            TaskId = entity.WorkflowTaskId.ToString(),
            Kind = entity.Kind,
            Status = entity.Status,
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Payload = payload,
            ReturnNote = entity.ReturnNote,
            SubmittedAtUtc = entity.SubmittedAtUtc?.ToString("O"),
            UpdatedAtUtc = entity.UpdatedAtUtc.ToString("O"),
        };
    }
}
