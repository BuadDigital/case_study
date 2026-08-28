using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Failures.Infrastructure.Services;

public class FailureService : IFailureService
{
    private const int MaxListRows = 500;
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private static readonly HashSet<string> ActiveStatuses = PropertyFailureStatus.Active;

    private readonly FailuresDbContext _failures;
    private readonly ICaseStudyLookup _caseStudyLookup;
    private readonly ICaseStudyFailureCommands _caseStudy;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IUserLabelLookup _labels;
    private readonly TimeProvider _time;

    public FailureService(
        FailuresDbContext failures,
        ICaseStudyLookup caseStudyLookup,
        ICaseStudyFailureCommands caseStudyCommands,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        IUserLabelLookup labels,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _failures = failures;
        _caseStudyLookup = caseStudyLookup;
        _caseStudy = caseStudyCommands;
        _notifications = notifications;
        _recipients = recipients;
        _labels = labels;
    }

    public async Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<PropertyFailure> query = _failures.PropertyFailures
            .AsNoTracking()
            .OrderByDescending(f => f.UpdatedAtUtc);

        var visiblePos = await ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is not null)
        {
            if (visiblePos.Count == 0)
                return [];
            query = query.Where(f => visiblePos.Contains(f.PoNumber));
        }

        var list = await query.Take(MaxListRows).ToListAsync(cancellationToken);
        var names = await _labels.ResolveManyAsync(
            list.Select(f => f.Specialist),
            cancellationToken);
        return list.Select(f => ToDto(f, names)).ToList();
    }

    public async Task<FailureRecordDto?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (!await CanReadPoAsync(poNumber, actor, cancellationToken))
            return null;

        var entity = await FindActiveForPropertyAsync(poNumber, propertyId, cancellationToken);
        return entity is null ? null : await ToDtoAsync(entity, cancellationToken);
    }

    private async Task<HashSet<string>?> ResolveVisiblePoNumbersAsync(
        PermissionsDto? actor,
        CancellationToken cancellationToken)
    {
        if (actor is null)
            return new HashSet<string>(StringComparer.Ordinal);

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)
            || actor.Capabilities.Contains("manage-failures", StringComparer.OrdinalIgnoreCase)
            || actor.Capabilities.Contains("manage-work-orders", StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        var assigneeId = actor.DistributionAssigneeId?.Trim() ?? "";
        var userId = actor.UserId.Trim();
        if (assigneeId.Length == 0 && userId.Length == 0)
            return new HashSet<string>(StringComparer.Ordinal);

        var pos = await _caseStudyLookup.ListPoNumbersByAssigneesAsync(
            [assigneeId, userId],
            cancellationToken);
        return pos.ToHashSet(StringComparer.Ordinal);
    }

    private async Task<bool> CanReadPoAsync(
        string poNumber,
        PermissionsDto? actor,
        CancellationToken cancellationToken)
    {
        var visiblePos = await ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is null) return true;
        return visiblePos.Contains(poNumber.Trim());
    }

    public async Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = ValidateCreate(request);
        if (errors.Count > 0) return (null, errors);

        if (Guid.TryParse(request.PropertyId.Trim(), out var createPropertyId))
        {
            var props = await _caseStudyLookup.ListPropertiesByIdsAsync(
                [createPropertyId],
                cancellationToken);
            if (props.Count == 0)
                return (null, new Dictionary<string, string> { ["propertyId"] = "العقار غير موجود" });
            if (props[0].IsRemoved)
                return (null, new Dictionary<string, string> { ["propertyId"] = "لا يمكن تسجيل تعذر على عقار محذوف" });
        }

        var now = _time.UtcNow();
        var title = ResolveTitle(request);
        var entity = PropertyFailure.Create(
            Guid.NewGuid(),
            request.PoNumber,
            request.PropertyId,
            request.DeedNumber,
            title,
            request.ProblemTypeId,
            NormalizeSeverity(request.Severity),
            PersonLabelResolver.NormalizeSystemLabel(
                string.IsNullOrWhiteSpace(request.RaisedByRole)
                    ? "الأخصائي"
                    : request.RaisedByRole.Trim()),
            request.InternalNote?.Trim() ?? "",
            await _labels.ResolveAsync(request.Specialist, cancellationToken),
            now);

        _failures.PropertyFailures.Add(entity);
        await _failures.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _caseStudy.RecordPropertyTimelineEventAsync(
                new PropertyTimelineRecordRequest(
                    entity.PoNumber,
                    propertyId,
                    $"failure:{entity.Id}:created",
                    "تسجيل تعذر",
                    $"{entity.Title} — {PropertyFailureStatus.LabelAr(entity.Status)}",
                    "warn",
                    now),
                cancellationToken);
        }

        if (entity.Severity == "internal")
            await ApplyInternalSideEffectsAsync(entity, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
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

    public async Task<FailureRecordDto?> EnsureSystemInternalFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string problemTypeId,
        string title,
        string note,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        var active = await FindActiveForPropertyAsync(poNumber, propertyId, cancellationToken);
        if (active is not null)
        {
            if (string.Equals(active.ProblemTypeId, problemTypeId, StringComparison.OrdinalIgnoreCase))
                return await ToDtoAsync(active, cancellationToken);
            return await ToDtoAsync(active, cancellationToken);
        }

        var resolvedSpecialist = await _labels.ResolveAsync(
            specialist,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(resolvedSpecialist)
            || string.Equals(resolvedSpecialist, "system", StringComparison.OrdinalIgnoreCase))
        {
            resolvedSpecialist = DocumentaryWorkflowRules.SystemRaiserRole;
        }

        var (result, _) = await CreateAsync(new CreateFailureRequest
        {
            PoNumber = poNumber,
            PropertyId = propertyId,
            DeedNumber = deedNumber,
            ProblemTypeId = problemTypeId,
            Severity = "internal",
            RaisedByRole = DocumentaryWorkflowRules.SystemRaiserRole,
            Title = title,
            InternalNote = note,
            Specialist = resolvedSpecialist,
        }, cancellationToken);

        return result;
    }

    public async Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TryUpgradeToInternal(_time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);
        await ApplyInternalSideEffectsAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> SubmitForReviewAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TrySubmitForReview(_time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            entity.Title.Trim().Length > 0 ? entity.Title : entity.InternalNote,
            cancellationToken);
        await NotifyFailureSubmittedAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> SuspendAsync(
        Guid id,
        string note,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TrySuspend(note, actorUserId, _time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _caseStudy.RecordPropertyTimelineEventAsync(
                new PropertyTimelineRecordRequest(
                    entity.PoNumber,
                    propertyId,
                    $"failure:{entity.Id}:suspended",
                    "تعليق المعاملة",
                    entity.FinalNote,
                    "warn",
                    entity.SuspendedAtUtc!.Value),
                cancellationToken);
        }

        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TryResolve(
                request.ResolutionReason,
                request.ContinueInstructions,
                _time.UtcNow()))
            return null;

        await _failures.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "فعال", cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> ApproveAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TryApprove(finalNote, _time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "موقوف", cancellationToken);
        await BlockPropertyTasksForApprovedFailureAsync(entity, cancellationToken);
        await NotifyFailureApprovedAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> ReturnAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TryReturn(finalNote, _time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "فعال", cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default)
    {
        var n = poNumber.Trim();
        await _failures.PropertyFailures
            .Where(f => f.PoNumber == n)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task ApplyEvictionHoldAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        const string evictionProblemTypeId = "access-denied";
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var now = _time.UtcNow();

        var existing = await _failures.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == propertyKey
                && f.Status != PropertyFailureStatus.Resolved)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            if (existing.Status != PropertyFailureStatus.Suspended)
            {
                existing.TryForceSuspend(
                    "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
                    now);
                existing.RefreshOpenHold(
                    evictionProblemTypeId,
                    "محظر إخلاء — تعليق الدراسة",
                    "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
                    now);
                await _failures.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskForHoldAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        var resolvedSpecialist = await _labels.ResolveAsync(
            string.IsNullOrWhiteSpace(specialist)
                ? DocumentaryWorkflowRules.SystemRaiserRole
                : specialist,
            cancellationToken);
        _failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            Guid.NewGuid(),
            po,
            propertyKey,
            deedNumber,
            "محظر إخلاء — تعليق الدراسة",
            evictionProblemTypeId,
            "internal",
            DocumentaryWorkflowRules.SystemRaiserRole,
            "تسجيل محظر إخلاء من وحدة الظروف/مسار الدخول.",
            "عُلّقت الدراسة تلقائياً بسبب تسجيل محظر إخلاء.",
            PropertyFailureStatus.Suspended,
            resolvedSpecialist,
            now,
            now,
            suspendedAtUtc: now));
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(po, propertyKey, "محظر إخلاء — تعليق الدراسة", cancellationToken);
    }

    public async Task ResolveEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default)
    {
        const string evictionProblemTypeId = "access-denied";
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var now = _time.UtcNow();

        var active = await _failures.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == propertyKey
                && f.ProblemTypeId == evictionProblemTypeId
                && f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Approved)
            .ToListAsync(cancellationToken);

        if (active.Count == 0)
        {
            await UnblockCaseStudyTaskForHoldAsync(po, propertyKey, cancellationToken);
            return;
        }

        var actorName = string.IsNullOrWhiteSpace(actor)
            ? DocumentaryWorkflowRules.SystemRaiserRole
            : actor.Trim();

        foreach (var failure in active)
        {
            failure.TrySystemResolve(
                "رفع محظر الإخلاء من وحدة الظروف",
                "أُزيل محظر الإخلاء — استئناف مسار الدراسة.",
                now,
                finalNoteIfEmpty: $"رُفع التعليق بواسطة {actorName}.");
        }

        await _failures.SaveChangesAsync(cancellationToken);
        await UnblockCaseStudyTaskForHoldAsync(po, propertyKey, cancellationToken);
    }

    public async Task EnsureKeyUnmatchedFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        const string keyUnmatchedProblemTypeId = "key-wont-open";
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var active = await _failures.PropertyFailures
            .AnyAsync(
                f =>
                    f.PoNumber == po
                    && f.PropertyId == propertyKey
                    && f.Status != PropertyFailureStatus.Resolved,
                cancellationToken);
        if (active) return;

        var now = _time.UtcNow();
        var resolvedSpecialist = await _labels.ResolveAsync(
            string.IsNullOrWhiteSpace(specialist)
                ? DocumentaryWorkflowRules.SystemRaiserRole
                : specialist,
            cancellationToken);
        _failures.PropertyFailures.Add(PropertyFailure.Create(
            Guid.NewGuid(),
            po,
            propertyKey,
            deedNumber,
            "مفتاح العقار غير مطابق",
            keyUnmatchedProblemTypeId,
            "internal",
            DocumentaryWorkflowRules.SystemRaiserRole,
            "تأكيد ميداني: المفتاح غير مطابق للصك.",
            resolvedSpecialist,
            now));
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(po, propertyKey, "مفتاح العقار غير مطابق", cancellationToken);
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

    private Task EscalateTaskObstructionAsync(
        PropertyFailure failure,
        string reason,
        CancellationToken cancellationToken) =>
        _caseStudy.EscalateObstructionAsync(
            new EscalateCaseStudyObstructionRequest
            {
                PoNumber = failure.PoNumber,
                PropertyId = failure.PropertyId,
                Reason = reason,
            },
            cancellationToken);

    private Task ResolveTaskObstructionAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken) =>
        _caseStudy.ResolveObstructionAsync(
            new ResolveCaseStudyObstructionRequest
            {
                PoNumber = failure.PoNumber,
                PropertyId = failure.PropertyId,
            },
            cancellationToken);

    private Task BlockPropertyTasksForApprovedFailureAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken)
    {
        var reason = failure.FinalNote.Trim().Length > 0
            ? failure.FinalNote.Trim()
            : (failure.Title.Trim().Length > 0 ? failure.Title.Trim() : "تعذر معتمد");

        return _caseStudy.BlockPropertyTasksForFailureAsync(
            new BlockCaseStudyTasksForFailureRequest
            {
                PoNumber = failure.PoNumber,
                PropertyId = failure.PropertyId,
                Reason = reason,
            },
            cancellationToken);
    }

    private Task SetPropertyDeedStatusAsync(
        PropertyFailure failure,
        string deedStatus,
        CancellationToken cancellationToken) =>
        _caseStudy.SetFailureDeedStatusAsync(
            new SetCaseStudyDeedStatusRequest
            {
                PoNumber = failure.PoNumber,
                PropertyId = failure.PropertyId,
                DeedNumber = failure.DeedNumber,
                DeedStatus = deedStatus,
            },
            cancellationToken);

    private async Task<PropertyFailure?> FindActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return await _failures.PropertyFailures
            .AsNoTracking()
            .Where(f =>
                f.PoNumber == po &&
                f.PropertyId == prop &&
                ActiveStatuses.Contains(f.Status))
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

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

    private async Task<FailureRecordDto> ToDtoAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        var names = await _labels.ResolveManyAsync(
            [entity.Specialist],
            cancellationToken);
        return ToDto(entity, names);
    }

    private static FailureRecordDto ToDto(
        PropertyFailure entity,
        IReadOnlyDictionary<string, string>? namesById = null) => new()
    {
        Id = entity.Id.ToString(),
        PoNumber = entity.PoNumber,
        PropertyId = entity.PropertyId,
        DeedNumber = entity.DeedNumber,
        Title = entity.Title,
        ProblemTypeId = entity.ProblemTypeId,
        Severity = entity.Severity,
        RaisedByRole = PersonLabelResolver.NormalizeSystemLabel(entity.RaisedByRole),
        InternalNote = entity.InternalNote,
        FinalNote = entity.FinalNote,
        ResolutionReason = entity.ResolutionReason,
        ContinueInstructions = entity.ContinueInstructions,
        Status = entity.Status,
        Specialist = namesById is null
            ? PersonLabelResolver.NormalizeSystemLabel(entity.Specialist)
            : PersonLabelResolver.ApplyResolved(entity.Specialist, namesById),
        CreatedAt = entity.CreatedAtUtc.ToString("O"),
        UpdatedAt = entity.UpdatedAtUtc.ToString("O"),
        SuspendedAt = entity.SuspendedAtUtc?.ToString("O"),
        SuspendedByUserId = entity.SuspendedByUserId,
    };

    private async Task BlockCaseStudyTaskForHoldAsync(
        string poNumber,
        string propertyIdText,
        string reason,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyIdText, out var propertyId)) return;

        var task = await _caseStudy.BlockTaskForHoldAsync(
            new CaseStudyHoldTaskRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
                Reason = reason,
            },
            cancellationToken);
        if (task is null) return;

        await NotifyHoldSpecialistAsync(
            task.TaskId,
            task.AssigneeId,
            "تعليق دراسة الحالة",
            reason,
            "warn",
            $"case-study-blocked:{task.TaskId}",
            cancellationToken);
    }

    private async Task UnblockCaseStudyTaskForHoldAsync(
        string poNumber,
        string propertyIdText,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyIdText, out var propertyId)) return;

        var task = await _caseStudy.UnblockTaskForHoldAsync(
            new CaseStudyHoldTaskRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
            },
            cancellationToken);
        if (task is null) return;

        await NotifyHoldSpecialistAsync(
            task.TaskId,
            task.AssigneeId,
            "استئناف دراسة الحالة",
            "زال سبب التعليق — استؤنفت المعاملة.",
            "success",
            $"case-study-unblocked:{task.TaskId}",
            cancellationToken);
    }

    private async Task NotifyHoldSpecialistAsync(
        Guid taskId,
        string? assigneeId,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var trimmedAssigneeId = assigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            trimmedAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = $"/case-study/{Uri.EscapeDataString(taskId.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = taskId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }
}
