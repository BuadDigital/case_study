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
/// - no EF (solid-scorecard finding 1). Holds live in <c>FailureService.Holds.cs</c>, the
/// notification fan-out in <c>FailureService.Notifications.cs</c>.
/// </summary>
public partial class FailureService : IFailureService
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
        return list.Select(f => FailureRecordRules.ToDto(f, names)).ToList();
    }

    private async Task<FailureRecordDto> ToDtoAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        var names = await _labels.ResolveManyAsync(
            [entity.Specialist],
            cancellationToken);
        return FailureRecordRules.ToDto(entity, names);
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

        var createPropertyId = FailureRules.ParsePropertyId(request.PropertyId);
        var props = await _caseStudyLookup.ListPropertiesByIdsAsync(
            [createPropertyId],
            cancellationToken);
        var targetErrors = FailureRecordRules.ValidateCreateTarget(props);
        if (targetErrors is not null) return (null, targetErrors);

        var now = _time.UtcNow();
        var entity = FailureRules.NewFailure(
            request,
            PersonLabelResolver.NormalizeSystemLabel(
                FailureRules.RaisedByRoleOrDefault(request.RaisedByRole)),
            await _labels.ResolveAsync(request.Specialist, cancellationToken),
            now);

        await _failures.AddAsync(entity, cancellationToken);
        await _failures.SaveChangesAsync(cancellationToken);

        await _caseStudy.RecordPropertyTimelineEventAsync(
            FailureRules.CreatedTimelineEntry(entity, entity.PropertyId, now),
            cancellationToken);

        if (entity.Severity == PropertyFailureSeverity.Internal)
            await ApplyInternalSideEffectsAsync(entity, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> ReportBourseObstructionAsync(
        BourseObstructionRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = FailureRecordRules.ValidateBourseObstruction(request);
        if (errors is not null) return (null, errors);

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
        await NotifyPoSpecialistsAsync(
            entity.PoNumber,
            FailureRules.SubmittedNotification(entity),
            cancellationToken);
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

        await _caseStudy.RecordPropertyTimelineEventAsync(
            FailureRules.SuspendedTimelineEntry(entity, entity.PropertyId),
            cancellationToken);

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

        await SetPropertyDeedStatusAsync(entity, FailureRecordRules.DeedStatusActive, cancellationToken);
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

        await SetPropertyDeedStatusAsync(entity, FailureRecordRules.DeedStatusSuspended, cancellationToken);
        await BlockPropertyTasksForApprovedFailureAsync(entity, cancellationToken);
        await NotifyPoSpecialistsAsync(
            entity.PoNumber,
            FailureRules.ApprovedNotification(entity),
            cancellationToken);
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

        await SetPropertyDeedStatusAsync(entity, FailureRecordRules.DeedStatusActive, cancellationToken);
        await ResolveTaskObstructionAsync(entity, cancellationToken);
        return await ToDtoAsync(entity, cancellationToken);
    }

    public async Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default)
    {
        await _failures.DeleteForPoAsync(poNumber, cancellationToken);
    }

    private async Task ApplyInternalSideEffectsAsync(
        PropertyFailure entity,
        CancellationToken cancellationToken)
    {
        await SetPropertyDeedStatusAsync(
            entity,
            FailureRecordRules.DeedStatusUnderVerification,
            cancellationToken);
        await EscalateTaskObstructionAsync(
            entity,
            FailureRecordRules.InternalObstructionReason(entity),
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
        if (!FailureRules.TryParsePropertyId(propertyId, out var propertyKey)) return null;
        return await _failures.GetActiveForPropertyAsync(poNumber, propertyKey, cancellationToken);
    }
}
