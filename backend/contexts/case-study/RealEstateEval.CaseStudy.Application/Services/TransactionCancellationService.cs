using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// «إلغاء المعاملة» — decided with Omar 2026-10-29: cancelling is for our own mistakes (a duplicate, a
/// wrong entry) after work began; a transaction Enfaz stops is a failure. The case specialist asks,
/// the section supervisor approves or rejects (his own request is approved at once) and may reactivate.
/// A cancellation covers whole transactions — every deed, in every work order. Cancelled deeds leave
/// every queue (their open tasks become cancelled), finished work stays finished and is paid, and a
/// work order whose live deeds are all cancelled reads «ملغى». Side effects outside Case Study (fees,
/// failures, key envelopes, notifications) run after the save and never undo it.
/// </summary>
public sealed partial class TransactionCancellationService(
    ITransactionCancellationRepository repo,
    IInspectorFeeService fees,
    ITransactionCancellationSideEffects sideEffects,
    IPropertyTimelineService timeline,
    INotificationService notifications,
    INotificationRecipientResolver recipients,
    IAuditLogWriter audit,
    IAuditLogAppend auditLog,
    TimeProvider? time = null) : ITransactionCancellationService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    /// <summary>What a request would cancel — the dialog shows it before anything is sent.</summary>
    /// <remarks>
    /// How it works: loads the deeds of the scope (the deed's transaction, or every transaction with a
    /// deed on the work order) and splits them with <see cref="TransactionCancellationRules.Split"/>,
    /// counting deeds already in a pending request as blocked.
    /// Edge cases: an unknown deed or work order is an error; a removed deed never shows.
    /// </remarks>
    public async Task<(TransactionCancellationPreviewDto? Result, string? Error)> PreviewAsync(
        Guid? propertyId,
        string? poNumber,
        CancellationToken cancellationToken = default)
    {
        var (scope, error) = await LoadScopeAsync(propertyId, poNumber, cancellationToken);
        if (error is not null) return (null, error);

        var pending = await PendingDeedIdsAsync(excludeRequestId: null, cancellationToken);
        var (deeds, excluded) = TransactionCancellationRules.Split(scope!.Deeds, pending);
        return (new TransactionCancellationPreviewDto
        {
            Scope = scope.Scope,
            ScopeRef = scope.ScopeRef,
            PoNumber = scope.PoNumber,
            Deeds = deeds,
            Excluded = excluded,
        }, null);
    }

    /// <summary>Raises a cancellation request; the supervisor's own request is approved in the same call.</summary>
    /// <remarks>
    /// How it works: 1) role (specialist, supervisor, CDO) and fields (scope, reason, note) are checked;
    /// 2) the scope's deeds are split — a transaction-scope request whose transaction is blocked is refused
    /// with the blocking reason, a work-order request keeps only the cancellable transactions and refuses
    /// when none is left; 3) the request stores the deed ids it covers and is saved; 4) a supervisor's
    /// request goes straight through <see cref="ApproveCoreAsync"/>, a specialist's notifies the supervisors.
    /// Edge cases: the deed list is fixed at request time — a deed added later is not swept in.
    /// </remarks>
    public async Task<(TransactionCancellationDto? Result, string? Error)> RequestAsync(
        RequestTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanRequestTransactionCancel(actor.Role))
            return (null, TransactionCancellationRules.ForbiddenRequestAr);
        var validation = TransactionCancellationRules.ValidateRequest(request);
        if (validation is not null) return (null, validation);

        var (scope, error) = await LoadScopeAsync(request.PropertyId, request.PoNumber, cancellationToken);
        if (error is not null) return (null, error);

        var pending = await PendingDeedIdsAsync(excludeRequestId: null, cancellationToken);
        var (deeds, excluded) = TransactionCancellationRules.Split(scope!.Deeds, pending);
        if (scope.Scope == TransactionCancellationScopes.Transaction && excluded.Count > 0)
            return (null, excluded[0].BlockedReason);
        if (deeds.Count == 0)
            return (null, TransactionCancellationRules.NothingToCancelAr);

        var now = _time.UtcNow();
        var entity = TransactionCancellation.Create(
            scope.Scope,
            scope.ScopeRef,
            scope.PoNumber,
            TransactionCancellationRules.SerializeDeedIds(deeds.Select(d => d.PropertyId)),
            request.ReasonCode,
            request.Note,
            request.AttachmentId,
            actor.UserId,
            actor.Name,
            now);
        await repo.AddAsync(entity, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
        await AppendAuditAsync(actor, "case-study.transaction-cancellation.requested", entity, cancellationToken);

        if (PoRoleMatrixRules.CanDecideTransactionCancel(actor.Role))
            return await ApproveCoreAsync(entity, null, actor, cancellationToken);

        await NotifySupervisorsOfRequestAsync(entity, deeds, cancellationToken);
        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(TransactionCancellationDto? Result, string? Error)> ApproveAsync(
        Guid id,
        DecideTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanDecideTransactionCancel(actor.Role))
            return (null, TransactionCancellationRules.ForbiddenDecideAr);
        var noteError = TransactionCancellationRules.ValidateOptionalNote(request.Note);
        if (noteError is not null) return (null, noteError);

        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, TransactionCancellationRules.RequestNotFoundAr);
        if (!entity.IsPending) return (null, TransactionCancellationRules.NotPendingAr);

        return await ApproveCoreAsync(entity, request.Note, actor, cancellationToken);
    }

    /// <summary>The supervisor rejects a pending request; nothing on the deeds changes.</summary>
    /// <remarks>
    /// How it works: checks the role, records the decision, saves, audits and tells the requester.
    /// Edge cases: a decided request is refused, so a double click never rejects twice.
    /// </remarks>
    public async Task<(TransactionCancellationDto? Result, string? Error)> RejectAsync(
        Guid id,
        DecideTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanDecideTransactionCancel(actor.Role))
            return (null, TransactionCancellationRules.ForbiddenDecideAr);
        var noteError = TransactionCancellationRules.ValidateOptionalNote(request.Note);
        if (noteError is not null) return (null, noteError);

        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, TransactionCancellationRules.RequestNotFoundAr);
        if (!entity.TryDecide(false, actor.UserId, actor.Name, request.Note, _time.UtcNow()))
            return (null, TransactionCancellationRules.NotPendingAr);

        await repo.SaveChangesAsync(cancellationToken);
        await AppendAuditAsync(actor, "case-study.transaction-cancellation.rejected", entity, cancellationToken);
        await NotifyRequesterAsync(
            entity,
            "رُفض طلب إلغاء المعاملة",
            string.IsNullOrWhiteSpace(entity.DecisionNote)
                ? $"رفض المشرف طلب إلغاء المعاملة في أمر العمل {entity.PoNumber}."
                : $"رفض المشرف طلب إلغاء المعاملة: {entity.DecisionNote}",
            NotificationContract.Tones.Info,
            cancellationToken);
        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    /// <summary>The supervisor reactivates an approved cancellation: tasks, deeds and keys go back as they were.</summary>
    /// <remarks>
    /// How it works: 1) role and reason checked, the request must be approved; 2) the deeds this request
    /// cancelled (by their cancellation id) get their status back and their tasks their status before;
    /// 3) one save, then the timeline, the key envelopes, the audit and the parties are told.
    /// Edge cases: a deed cancelled by a different request is left alone; failures closed by the
    /// cancellation stay closed — the specialist raises a new one if the problem is still there.
    /// </remarks>
    public async Task<(TransactionCancellationDto? Result, string? Error)> ReactivateAsync(
        Guid id,
        ReactivateTransactionCancellationRequest request,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanDecideTransactionCancel(actor.Role))
            return (null, TransactionCancellationRules.ForbiddenDecideAr);
        var noteError = TransactionCancellationRules.ValidateNote(
            request.Note,
            TransactionCancellationRules.ReactivationNoteRequiredAr);
        if (noteError is not null) return (null, noteError);

        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, TransactionCancellationRules.RequestNotFoundAr);

        var now = _time.UtcNow();
        if (!entity.TryReactivate(actor.UserId, actor.Name, request.Note, now))
            return (null, TransactionCancellationRules.NotApprovedAr);

        var deeds = (await repo.ListDeedsByIdsAsync(
                TransactionCancellationRules.ParseDeedIds(entity.DeedIdsJson).ToList(),
                cancellationToken))
            .Where(d => d.CancellationId == entity.Id)
            .ToList();
        var deedIds = deeds.Select(d => d.Id).ToList();
        foreach (var task in await repo.ListTasksForUpdateAsync(deedIds, cancellationToken))
            task.RestoreAfterTransactionCancel(now);
        foreach (var deed in deeds)
            deed.ClearCancellation();
        await repo.SaveChangesAsync(cancellationToken);

        await RecordTimelineAsync(
            deeds,
            $"transaction-reactivated:{entity.Id:N}",
            "إعادة تفعيل المعاملة",
            $"{actor.Name}: {entity.ReactivationNote}",
            PropertyTimelineTones.Active,
            now,
            cancellationToken);
        await BestEffortAsync(() => sideEffects.SetKeysPropertyCancelledAsync(deedIds, false, actor.Name, cancellationToken));
        await AppendAuditAsync(actor, "case-study.transaction-cancellation.reactivated", entity, cancellationToken);

        var told = await ResolveDeedPeopleAsync(deeds, cancellationToken);
        await NotifyUsersAsync(
            told,
            entity,
            "أُعيد تفعيل المعاملة",
            $"أعاد المشرف تفعيل المعاملة في أمر العمل {entity.PoNumber} — تابع العمل عليها: {entity.ReactivationNote}",
            NotificationContract.Tones.Info,
            "reactivated",
            cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<TransactionCancellationStateDto> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var deed = await repo.GetDeedAsync(propertyId, cancellationToken);
        if (deed is null) return new TransactionCancellationStateDto();

        TransactionCancellation? pending = null;
        foreach (var row in await repo.ListAsync(TransactionCancellationStatuses.Pending, cancellationToken))
        {
            if (!TransactionCancellationRules.ParseDeedIds(row.DeedIdsJson).Contains(propertyId)) continue;
            pending = row;
            break;
        }

        var cancelled = deed.CancellationId is Guid cancellationId
            ? await repo.FindAsync(cancellationId, cancellationToken)
            : null;

        return new TransactionCancellationStateDto
        {
            Pending = pending is null ? null : await ToDtoAsync(pending, cancellationToken),
            Cancelled = cancelled is null || !deed.IsCancelled ? null : await ToDtoAsync(cancelled, cancellationToken),
        };
    }

    public async Task<IReadOnlyList<TransactionCancellationDto>> ListAsync(
        string? status,
        CancellationToken cancellationToken = default)
    {
        var normalized = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToLowerInvariant();
        var rows = await repo.ListAsync(normalized, cancellationToken);
        var result = new List<TransactionCancellationDto>(rows.Count);
        foreach (var row in rows)
            result.Add(await ToDtoAsync(row, cancellationToken));
        return result;
    }

    /// <summary>The approval itself, shared by the supervisor's decision and his own direct request.</summary>
    /// <remarks>
    /// How it works: 1) reloads the request's deeds and re-checks every one (a deed handed over to Enfaz
    /// or final-failed since the request was raised refuses the whole approval); 2) resolves who to tell
    /// BEFORE cancelling — the recipient lookup skips cancelled tasks; 3) cancels every open/blocked task
    /// (finished ones stay), marks every deed «ملغى» and approves the request — one save; 4) then, best
    /// effort: timeline per deed, fee ledgers for finished field work, open failures closed, key envelopes
    /// marked, audit, notifications.
    /// Edge cases: the request itself is excluded from the pending check, or it would block itself.
    /// </remarks>
    private async Task<(TransactionCancellationDto? Result, string? Error)> ApproveCoreAsync(
        TransactionCancellation entity,
        string? note,
        TransactionCancellationActor actor,
        CancellationToken cancellationToken)
    {
        var deedIds = TransactionCancellationRules.ParseDeedIds(entity.DeedIdsJson).ToList();
        var deeds = (await repo.ListDeedsByIdsAsync(deedIds, cancellationToken))
            .Where(d => !d.IsRemoved)
            .ToList();
        if (deeds.Count == 0) return (null, TransactionCancellationRules.NothingToCancelAr);

        var pending = await PendingDeedIdsAsync(excludeRequestId: entity.Id, cancellationToken);
        foreach (var deed in deeds)
        {
            var reason = TransactionCancellationRules.DeedBlockReasonAr(deed, pending.Contains(deed.Id));
            if (reason is not null) return (null, $"صك {deed.DeedNumber}: {reason}");
        }

        var told = await ResolveDeedPeopleAsync(deeds, cancellationToken);

        var now = _time.UtcNow();
        var liveIds = deeds.Select(d => d.Id).ToList();
        foreach (var task in await repo.ListTasksForUpdateAsync(liveIds, cancellationToken))
            task.CancelForTransaction(now);
        foreach (var deed in deeds)
            deed.MarkCancelled(entity.Id, now);
        entity.TryDecide(true, actor.UserId, actor.Name, note, now);
        await repo.SaveChangesAsync(cancellationToken);

        await RecordTimelineAsync(
            deeds,
            $"transaction-cancelled:{entity.Id:N}",
            "إلغاء المعاملة",
            $"{TransactionCancellationRules.ReasonLine(entity)} — اعتمده {actor.Name}",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);
        foreach (var deed in deeds)
        {
            // Finished field work before the cancellation is paid (decision 2026-10-29).
            await BestEffortAsync(() => fees.EnsureLedgersForPropertyAsync(deed.Id, cancellationToken));
            await BestEffortAsync(() => sideEffects.CloseOpenFailuresAsync(
                deed.WorkOrder?.PoNumber ?? entity.PoNumber,
                deed.Id,
                actor.Name,
                cancellationToken));
        }
        await BestEffortAsync(() => sideEffects.SetKeysPropertyCancelledAsync(liveIds, true, actor.Name, cancellationToken));
        await AppendAuditAsync(actor, "case-study.transaction-cancellation.approved", entity, cancellationToken);

        await NotifyUsersAsync(
            told,
            entity,
            "أُلغيت المعاملة",
            $"أُلغيت المعاملة في أمر العمل {entity.PoNumber} ({TransactionCancellationRules.ReasonLine(entity)}) — أوقف العمل عليها.",
            NotificationContract.Tones.Warn,
            "approved",
            cancellationToken);
        if (!string.Equals(entity.RequestedByUserId, actor.UserId, StringComparison.Ordinal))
        {
            await NotifyRequesterAsync(
                entity,
                "اعتُمد إلغاء المعاملة",
                $"اعتمد المشرف إلغاء المعاملة في أمر العمل {entity.PoNumber}.",
                NotificationContract.Tones.Info,
                cancellationToken);
        }

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    private sealed record CancellationScope(
        string Scope,
        string ScopeRef,
        string PoNumber,
        IReadOnlyList<WorkOrderProperty> Deeds);

    /// <summary>The deeds a request covers: the deed's whole transaction, or every transaction on the work order.</summary>
    private async Task<(CancellationScope? Scope, string? Error)> LoadScopeAsync(
        Guid? propertyId,
        string? poNumber,
        CancellationToken cancellationToken)
    {
        if (propertyId is Guid id)
        {
            var anchor = await repo.GetDeedAsync(id, cancellationToken);
            if (anchor is null) return (null, TransactionCancellationRules.PropertyNotFoundAr);
            var deeds = await repo.ListTransactionDeedsAsync(anchor.TransactionId, cancellationToken);
            return (new CancellationScope(
                TransactionCancellationScopes.Transaction,
                anchor.TransactionId.ToString("D"),
                anchor.WorkOrder?.PoNumber ?? "",
                deeds), null);
        }

        var po = poNumber?.Trim() ?? "";
        if (po.Length == 0) return (null, TransactionCancellationRules.ScopeRequiredAr);
        var orderDeeds = await repo.ListWorkOrderTransactionDeedsAsync(po, cancellationToken);
        if (orderDeeds.Count == 0) return (null, TransactionCancellationRules.WorkOrderNotFoundAr);
        return (new CancellationScope(TransactionCancellationScopes.WorkOrder, po, po, orderDeeds), null);
    }

    /// <summary>Deeds already covered by a pending request (other than <paramref name="excludeRequestId"/>).</summary>
    private async Task<IReadOnlySet<Guid>> PendingDeedIdsAsync(
        Guid? excludeRequestId,
        CancellationToken cancellationToken)
    {
        var ids = new HashSet<Guid>();
        foreach (var row in await repo.ListAsync(TransactionCancellationStatuses.Pending, cancellationToken))
        {
            if (row.Id == excludeRequestId) continue;
            ids.UnionWith(TransactionCancellationRules.ParseDeedIds(row.DeedIdsJson));
        }
        return ids;
    }

    private async Task<TransactionCancellationDto> ToDtoAsync(
        TransactionCancellation entity,
        CancellationToken cancellationToken)
    {
        var deeds = await repo.ListDeedsByIdsAsync(
            TransactionCancellationRules.ParseDeedIds(entity.DeedIdsJson).ToList(),
            cancellationToken);
        return new TransactionCancellationDto
        {
            Id = entity.Id,
            Scope = entity.Scope,
            ScopeRef = entity.ScopeRef,
            PoNumber = entity.PoNumber,
            Status = entity.Status,
            ReasonCode = entity.ReasonCode,
            ReasonLabel = TransactionCancellationReasons.LabelAr(entity.ReasonCode),
            Note = entity.Note,
            AttachmentId = entity.AttachmentId,
            Deeds = deeds
                .OrderBy(d => d.WorkOrder?.PoNumber ?? "", StringComparer.Ordinal)
                .ThenBy(d => d.DeedNumber, StringComparer.Ordinal)
                .Select(d => TransactionCancellationRules.ToDeedDto(d, null))
                .ToList(),
            RequestedByName = entity.RequestedByName,
            RequestedAtUtc = entity.RequestedAtUtc,
            DecidedByName = entity.DecidedByName,
            DecidedAtUtc = entity.DecidedAtUtc,
            DecisionNote = entity.DecisionNote,
            ReactivatedByName = entity.ReactivatedByName,
            ReactivatedAtUtc = entity.ReactivatedAtUtc,
            ReactivationNote = entity.ReactivationNote,
        };
    }
}
