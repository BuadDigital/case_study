using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public class FailureService : IFailureService
{
    private const string CaseStudyPropertyKind = "case-study-property";

    private static readonly HashSet<string> ActiveStatuses = PropertyFailureStatus.Active;

    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskService _tasks;
    private readonly IPropertyTimelineService _timeline;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;

    public FailureService(
        ApplicationDbContext db,
        IWorkflowTaskService tasks,
        IPropertyTimelineService timeline,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
    {
        _db = db;
        _tasks = tasks;
        _timeline = timeline;
        _notifications = notifications;
        _recipients = recipients;
    }

    public async Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var list = await _db.PropertyFailures
            .AsNoTracking()
            .OrderByDescending(f => f.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
        return list.Select(ToDto).ToList();
    }

    public async Task<FailureRecordDto?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var entity = await FindActiveForPropertyAsync(poNumber, propertyId, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = ValidateCreate(request);
        if (errors.Count > 0) return (null, errors);

        var now = DateTime.UtcNow;
        var title = ResolveTitle(request);
        var entity = new PropertyFailure
        {
            Id = Guid.NewGuid(),
            PoNumber = request.PoNumber.Trim(),
            PropertyId = request.PropertyId.Trim(),
            DeedNumber = request.DeedNumber.Trim(),
            Title = title,
            ProblemTypeId = request.ProblemTypeId.Trim(),
            Severity = NormalizeSeverity(request.Severity),
            RaisedByRole = string.IsNullOrWhiteSpace(request.RaisedByRole)
                ? "الأخصائي"
                : request.RaisedByRole.Trim(),
            InternalNote = request.InternalNote?.Trim() ?? "",
            Status = PropertyFailureStatus.Internal,
            Specialist = request.Specialist.Trim(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.PropertyFailures.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _timeline.RecordAsync(
                entity.PoNumber,
                propertyId,
                $"failure:{entity.Id}:created",
                "تسجيل تعذر",
                $"{entity.Title} — {FailureStatusLabel(entity.Status)}",
                "warn",
                now,
                cancellationToken);
        }

        if (entity.Severity == "internal")
            await ApplyInternalSideEffectsAsync(entity, cancellationToken);

        return (ToDto(entity), null);
    }

    public async Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> ReportBourseObstructionAsync(
        BourseObstructionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return (null, new Dictionary<string, string> { ["reason"] = "سبب التعذر مطلوب" });

        var create = await CreateAsync(new CreateFailureRequest
        {
            PoNumber = request.PoNumber,
            PropertyId = request.PropertyId,
            DeedNumber = request.DeedNumber,
            ProblemTypeId = "deed-inactive",
            Severity = "internal",
            RaisedByRole = "الأخصائي",
            Title = "متعذر — الصك غير فعال",
            InternalNote = request.Reason.Trim(),
            Specialist = request.Specialist,
        }, cancellationToken);

        if (create.Result is null) return create;

        var submitted = await SubmitForReviewAsync(Guid.Parse(create.Result.Id), cancellationToken);
        return (submitted, null);
    }

    public async Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (entity.Status != PropertyFailureStatus.Internal || entity.Severity != "suspected") return null;

        entity.Severity = "internal";
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await ApplyInternalSideEffectsAsync(entity, cancellationToken);
        return ToDto(entity);
    }

    public async Task<FailureRecordDto?> SubmitForReviewAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (entity.Status is not (PropertyFailureStatus.Internal or PropertyFailureStatus.Returned)) return null;

        entity.Status = PropertyFailureStatus.Review;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            entity.Title.Trim().Length > 0 ? entity.Title : entity.InternalNote,
            cancellationToken);
        await NotifyFailureSubmittedAsync(entity, cancellationToken);
        return ToDto(entity);
    }

    public async Task<FailureRecordDto?> SuspendAsync(
        Guid id,
        string note,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null || entity.Status != PropertyFailureStatus.Review) return null;

        entity.Status = PropertyFailureStatus.Suspended;
        entity.FinalNote = note.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _timeline.RecordAsync(
                entity.PoNumber,
                propertyId,
                $"failure:{entity.Id}:suspended",
                "تعليق المعاملة",
                entity.FinalNote,
                "warn",
                entity.UpdatedAtUtc,
                cancellationToken);
        }

        return ToDto(entity);
    }

    public async Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null || !IsActiveStatus(entity.Status) || entity.Status == PropertyFailureStatus.Approved) return null;

        entity.Status = PropertyFailureStatus.Resolved;
        entity.ResolutionReason = request.ResolutionReason.Trim();
        entity.ContinueInstructions = request.ContinueInstructions.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "فعال", cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return ToDto(entity);
    }

    public async Task<FailureRecordDto?> ApproveAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null || entity.Status != PropertyFailureStatus.Review) return null;

        entity.Status = PropertyFailureStatus.Approved;
        entity.FinalNote = finalNote.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "موقوف", cancellationToken);
        await NotifyFailureApprovedAsync(entity, cancellationToken);
        return ToDto(entity);
    }

    public async Task<FailureRecordDto?> ReturnAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null || entity.Status != PropertyFailureStatus.Review) return null;

        entity.Status = PropertyFailureStatus.Returned;
        entity.FinalNote = finalNote.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "فعال", cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return ToDto(entity);
    }

    public async Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default)
    {
        var n = poNumber.Trim();
        await _db.PropertyFailures
            .Where(f => f.PoNumber == n)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task ApplyInternalSideEffectsAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        await SetPropertyDeedStatusAsync(entity, "قيد التحقق", cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            entity.Title.Trim().Length > 0 ? entity.Title : entity.InternalNote.Trim(),
            cancellationToken);
    }

    private async Task EscalateTaskObstructionAsync(
        PropertyFailure failure,
        string reason,
        CancellationToken cancellationToken)
    {
        var task = await FindCaseStudyTaskAsync(failure.PoNumber, failure.PropertyId, cancellationToken);
        if (task is null || task.Status == WorkflowTaskStatus.Completed) return;

        await _tasks.PatchAsync(
            task.Id,
            new PatchWorkflowTaskRequest
            {
                Phase = "obstruction",
                ObstructionPriorPhase = task.Phase,
                AssigneeRole = "section-supervisor",
                AssigneeName = "مشرف دراسة الحالة",
                Status = WorkflowTaskStatus.Blocked,
                ObstructionReason = reason.Trim(),
            },
            cancellationToken);
    }

    private async Task ResolveTaskObstructionAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken)
    {
        var task = await FindCaseStudyTaskAsync(failure.PoNumber, failure.PropertyId, cancellationToken);
        if (task is null || task.Phase != "obstruction") return;

        var resumePhase = string.IsNullOrWhiteSpace(task.ObstructionPriorPhase)
            ? (task.PropertyId.HasValue ? "bourse" : "enfath")
            : task.ObstructionPriorPhase;

        await _tasks.PatchAsync(
            task.Id,
            new PatchWorkflowTaskRequest
            {
                Phase = resumePhase,
                AssigneeRole = "case-specialist",
                AssigneeName = "أخصائي دراسة الحالة",
                Status = WorkflowTaskStatus.Open,
                ObstructionReason = "",
                ObstructionPriorPhase = "",
            },
            cancellationToken);
    }

    private async Task<WorkflowTask?> FindCaseStudyTaskAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var propertyGuid = await ResolvePropertyGuidAsync(po, propertyId.Trim(), cancellationToken);
        if (!propertyGuid.HasValue) return null;

        return await _db.WorkflowTasks.FirstOrDefaultAsync(
            t =>
                t.PoNumber == po &&
                t.Kind == CaseStudyPropertyKind &&
                t.Status != WorkflowTaskStatus.Completed &&
                t.PropertyId == propertyGuid,
            cancellationToken);
    }

    private async Task<Guid?> ResolvePropertyGuidAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        if (Guid.TryParse(propertyId, out var guid)) return guid;

        var order = await _db.WorkOrders
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == poNumber.Trim(), cancellationToken);
        var prop = order?.Properties.FirstOrDefault(p =>
            p.DeedNumber == propertyId || p.Id.ToString() == propertyId);
        return prop?.Id;
    }

    private async Task SetPropertyDeedStatusAsync(
        PropertyFailure failure,
        string deedStatus,
        CancellationToken cancellationToken)
    {
        var order = await _db.WorkOrders
            .Include(w => w.Properties)
            .FirstOrDefaultAsync(w => w.PoNumber == failure.PoNumber.Trim(), cancellationToken);
        if (order is null) return;

        var prop = order.Properties.FirstOrDefault(p =>
            p.Id.ToString() == failure.PropertyId.Trim() ||
            p.DeedNumber == failure.PropertyId.Trim() ||
            p.DeedNumber == failure.DeedNumber.Trim());
        if (prop is null && Guid.TryParse(failure.PropertyId, out var gid))
            prop = order.Properties.FirstOrDefault(p => p.Id == gid);
        if (prop is null) return;

        prop.DeedStatus = deedStatus;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<PropertyFailure?> FindActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return await _db.PropertyFailures
            .AsNoTracking()
            .Where(f =>
                f.PoNumber == po &&
                f.PropertyId == prop &&
                ActiveStatuses.Contains(f.Status))
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static bool IsActiveStatus(string status) =>
        PropertyFailureStatus.IsActive(status);

    private static string NormalizeSeverity(string severity) =>
        severity.Trim().ToLowerInvariant() == "suspected" ? "suspected" : "internal";

    private static string ResolveTitle(CreateFailureRequest request)
    {
        var custom = request.Title?.Trim();
        if (!string.IsNullOrEmpty(custom)) return custom;
        if (request.ProblemTypeId == "deed-inactive") return "متعذر — الصك غير فعال";
        return request.ProblemTypeId.Trim();
    }

    private static Dictionary<string, string> ValidateCreate(CreateFailureRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.PoNumber))
            errors["poNumber"] = "رقم أمر العمل مطلوب";
        if (string.IsNullOrWhiteSpace(request.PropertyId))
            errors["propertyId"] = "معرف العقار مطلوب";
        if (string.IsNullOrWhiteSpace(request.Specialist))
            errors["specialist"] = "اسم الأخصائي مطلوب";
        return errors;
    }

    private static string FailureStatusLabel(string status) => status switch
    {
        PropertyFailureStatus.Internal => "داخلي",
        PropertyFailureStatus.Review => "قيد المراجعة",
        PropertyFailureStatus.Approved => "معتمد",
        PropertyFailureStatus.Returned => "مُعاد",
        PropertyFailureStatus.Resolved => "محلول",
        PropertyFailureStatus.Suspended => "معلق",
        _ => status,
    };

    private async Task NotifyFailureSubmittedAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPoAsync(
            entity.PoNumber,
            [CaseStudyPropertyKind],
            cancellationToken);

        if (recipientIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipientIds,
            new CreateUserNotificationRequest
            {
                Title = "تعذر بانتظار المراجعة",
                Body = $"رُفع تعذر للمراجعة على أمر العمل {entity.PoNumber}.",
                Tone = "warn",
                Href = "/failures",
                Category = "failures",
                EntityType = "failure",
                EntityId = entity.Id.ToString(),
                Actor = entity.Specialist,
                SourceEvent = $"failure-submitted:{entity.Id}",
            },
            cancellationToken);
    }

    private async Task NotifyFailureApprovedAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPoAsync(
            entity.PoNumber,
            [CaseStudyPropertyKind],
            cancellationToken);

        if (recipientIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipientIds,
            new CreateUserNotificationRequest
            {
                Title = "اعتماد تعذر",
                Body = $"اعتُمد تعذر على أمر العمل {entity.PoNumber}.",
                Tone = "warn",
                Href = "/failures",
                Category = "failures",
                EntityType = "failure",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"failure-approved:{entity.Id}",
            },
            cancellationToken);
    }

    private static FailureRecordDto ToDto(PropertyFailure entity) => new()
    {
        Id = entity.Id.ToString(),
        PoNumber = entity.PoNumber,
        PropertyId = entity.PropertyId,
        DeedNumber = entity.DeedNumber,
        Title = entity.Title,
        ProblemTypeId = entity.ProblemTypeId,
        Severity = entity.Severity,
        RaisedByRole = entity.RaisedByRole,
        InternalNote = entity.InternalNote,
        FinalNote = entity.FinalNote,
        ResolutionReason = entity.ResolutionReason,
        ContinueInstructions = entity.ContinueInstructions,
        Status = entity.Status,
        Specialist = entity.Specialist,
        CreatedAt = entity.CreatedAtUtc.ToString("O"),
        UpdatedAt = entity.UpdatedAtUtc.ToString("O"),
    };
}
