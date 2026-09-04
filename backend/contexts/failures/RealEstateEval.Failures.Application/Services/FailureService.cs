using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// Property-failure use cases: raise, escalate, review, resolve, and the system-owned eviction
/// and key-unmatched holds, together with the case-study task and notification side effects.
/// Persistence goes through <see cref="IFailureRepository"/>, so this file holds workflow only
/// - no EF (solid-scorecard finding 1).
/// </summary>
public class FailureService : IFailureService
{
    private const int MaxListRows = 500;
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private readonly IFailureRepository _failures;
    private readonly ICaseStudyLookup _caseStudyLookup;
    private readonly ICaseStudyFailureCommands _caseStudy;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IUserLabelLookup _labels;
    private readonly TimeProvider _time;

    public FailureService(
        IFailureRepository failures,
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

    public Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListAsync(FailureListQuery.Empty, actor, cancellationToken);

    public async Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var visiblePos = await ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        var list = await _failures.ListPageAsync(
            visiblePos,
            query,
            0,
            MaxListRows,
            cancellationToken);
        return await ToDtosAsync(list, cancellationToken);
    }

 /// <summary>
 /// Filtered / sorted page. Visibility narrows the query before the count, so TotalCount is the
 /// actor's total. See docs/architecture/pagination-contract.md §5.
 /// </summary>
    public async Task<PagedResultDto<FailureRecordDto>> ListPagedAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var visiblePos = await ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        var total = await _failures.CountAsync(visiblePos, query, cancellationToken);
        var list = await _failures.ListPageAsync(visiblePos, query, skip, take, cancellationToken);

        return new PagedResultDto<FailureRecordDto>
        {
            Items = await ToDtosAsync(list, cancellationToken),
            TotalCount = total,
            Page = page,
            PageSize = take,
        };
    }

    private async Task<IReadOnlyList<FailureRecordDto>> ToDtosAsync(
        IReadOnlyList<PropertyFailure> list,
        CancellationToken cancellationToken)
    {
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

        if (FailureRules.SeesEveryFailure(actor))
            return null;

        if (FailureRules.HasNoVisibilityKey(actor))
            return new HashSet<string>(StringComparer.Ordinal);

        var pos = await _caseStudyLookup.ListPoNumbersByAssigneesAsync(
            FailureRules.VisibilityAssigneeKeys(actor),
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
        var errors = FailureRules.ValidateCreate(request);
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
        var entity = FailureRules.NewFailure(
            request,
            PersonLabelResolver.NormalizeSystemLabel(
                FailureRules.RaisedByRoleOrDefault(request.RaisedByRole)),
            await _labels.ResolveAsync(request.Specialist, cancellationToken),
            now);

        await _failures.AddAsync(entity, cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _caseStudy.RecordPropertyTimelineEventAsync(
                FailureRules.CreatedTimelineEntry(entity, propertyId, now),
                cancellationToken);
        }

        if (entity.Severity == PropertyFailureSeverity.Internal)
            await ApplyInternalSideEffectsAsync(entity, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> ReportBourseObstructionAsync(
        BourseObstructionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return (null, new Dictionary<string, string> { ["reason"] = "سبب التعذر مطلوب" });

        var create = await CreateAsync(
            FailureRules.BourseObstructionCreateRequest(request),
            cancellationToken);

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

        var resolvedSpecialist = FailureRules.SpecialistOrSystem(
            await _labels.ResolveAsync(specialist, cancellationToken));

        var (result, _) = await CreateAsync(
            FailureRules.SystemInternalCreateRequest(
                poNumber,
                propertyId,
                deedNumber,
                problemTypeId,
                title,
                note,
                resolvedSpecialist),
            cancellationToken);

        return result;
    }

    public async Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        // Domain Try* + side effects (tasks/notifications/timeline) require a
        // loaded entity — ExecuteUpdateAsync would skip rules and those writes.
        var entity = await _failures.FindAsync(id, cancellationToken);
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
        var entity = await _failures.FindAsync(id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TrySubmitForReview(_time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            FailureRules.ObstructionReason(entity),
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
        var entity = await _failures.FindAsync(id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TrySuspend(note, actorUserId, _time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);

        if (Guid.TryParse(entity.PropertyId, out var propertyId))
        {
            await _caseStudy.RecordPropertyTimelineEventAsync(
                FailureRules.SuspendedTimelineEntry(entity, propertyId),
                cancellationToken);
        }

        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _failures.FindAsync(id, cancellationToken);
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
        var entity = await _failures.FindAsync(id, cancellationToken);
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
        var entity = await _failures.FindAsync(id, cancellationToken);
        if (entity is null) return null;
        if (!entity.TryReturn(finalNote, _time.UtcNow())) return null;

        await _failures.SaveChangesAsync(cancellationToken);

        await SetPropertyDeedStatusAsync(entity, "فعال", cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default)
    {
        await _failures.DeleteForPoAsync(poNumber, cancellationToken);
    }

    public async Task ApplyEvictionHoldAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var now = _time.UtcNow();

        var existing = await _failures.FindLatestUnresolvedAsync(
            po, propertyKey, cancellationToken);

        if (existing is not null)
        {
            if (existing.Status != PropertyFailureStatus.Suspended)
            {
                existing.TryForceSuspend(FailureRules.EvictionSuspendNote, now);
                existing.RefreshOpenHold(
                    FailureRules.EvictionProblemTypeId,
                    FailureRules.EvictionTitle,
                    FailureRules.EvictionSuspendNote,
                    now);
                await _failures.SaveChangesAsync(cancellationToken);
            }

            await BlockCaseStudyTaskForHoldAsync(po, propertyKey, existing.Title, cancellationToken);
            return;
        }

        var resolvedSpecialist = await _labels.ResolveAsync(
            FailureRules.ActorOrSystem(specialist),
            cancellationToken);
        await _failures.AddAsync(
            FailureRules.NewEvictionHold(po, propertyKey, deedNumber, resolvedSpecialist, now),
            cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(
            po,
            propertyKey,
            FailureRules.EvictionTitle,
            cancellationToken);
    }

    public async Task ResolveEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var now = _time.UtcNow();

        var active = await _failures.FindOpenEvictionHoldsAsync(
            po, propertyKey, FailureRules.EvictionProblemTypeId, cancellationToken);

        if (active.Count == 0)
        {
            await UnblockCaseStudyTaskForHoldAsync(po, propertyKey, cancellationToken);
            return;
        }

        var actorName = FailureRules.ActorOrSystem(actor);

        foreach (var failure in active)
        {
            failure.TrySystemResolve(
                FailureRules.EvictionResolutionReason,
                FailureRules.EvictionContinueInstructions,
                now,
                finalNoteIfEmpty: FailureRules.EvictionLiftedNote(actorName));
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
        var po = poNumber.Trim();
        var propertyKey = propertyId.Trim();
        var active = await _failures.HasUnresolvedAsync(po, propertyKey, cancellationToken);
        if (active) return;

        var now = _time.UtcNow();
        var resolvedSpecialist = await _labels.ResolveAsync(
            FailureRules.ActorOrSystem(specialist),
            cancellationToken);
        await _failures.AddAsync(
            FailureRules.NewKeyUnmatchedFailure(
                po, propertyKey, deedNumber, resolvedSpecialist, now),
            cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);
        await BlockCaseStudyTaskForHoldAsync(
            po,
            propertyKey,
            FailureRules.KeyUnmatchedTitle,
            cancellationToken);
    }

    private async Task ApplyInternalSideEffectsAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        await SetPropertyDeedStatusAsync(entity, "قيد التحقق", cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            FailureRules.ObstructionReason(entity).Trim(),
            cancellationToken);
    }

    private Task EscalateTaskObstructionAsync(
        PropertyFailure failure,
        string reason,
        CancellationToken cancellationToken) =>
        _caseStudy.EscalateObstructionAsync(
            FailureRules.EscalateRequest(failure, reason),
            cancellationToken);

    private Task ResolveTaskObstructionAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken) =>
        _caseStudy.ResolveObstructionAsync(
            FailureRules.ResolveObstructionRequest(failure),
            cancellationToken);

    private Task BlockPropertyTasksForApprovedFailureAsync(
        PropertyFailure failure,
        CancellationToken cancellationToken) =>
        _caseStudy.BlockPropertyTasksForFailureAsync(
            FailureRules.BlockTasksRequest(failure),
            cancellationToken);

    private Task SetPropertyDeedStatusAsync(
        PropertyFailure failure,
        string deedStatus,
        CancellationToken cancellationToken) =>
        _caseStudy.SetFailureDeedStatusAsync(
            FailureRules.DeedStatusRequest(failure, deedStatus),
            cancellationToken);

    private async Task<PropertyFailure?> FindActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        return await _failures.GetActiveForPropertyAsync(poNumber, propertyId, cancellationToken);
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
            FailureRules.SubmittedNotification(entity),
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
            FailureRules.ApprovedNotification(entity),
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
            task.AssigneeId,
            FailureRules.CaseStudyBlockedNotification(task.TaskId, reason),
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
            task.AssigneeId,
            FailureRules.CaseStudyUnblockedNotification(task.TaskId),
            cancellationToken);
    }

    private async Task NotifyHoldSpecialistAsync(
        string? assigneeId,
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        var trimmedAssigneeId = assigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            trimmedAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(userId, notification, cancellationToken);
    }
}
