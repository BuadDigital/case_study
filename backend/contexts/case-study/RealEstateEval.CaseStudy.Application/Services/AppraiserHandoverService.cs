using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// The appraiser hands a transaction on without reassigning it himself (Omar 2026-11-18).
/// </summary>
/// <remarks>
/// How it works:
/// <list type="bullet">
/// <item>Reassignment request: it goes to whoever formally handed him the transaction at its current stage
/// — the study specialist who issued the study while he values it, the reviewer once he handed his value
/// over. That person has it alone for <see cref="HeadStartWorkingMinutes"/> working minutes, then the whole
/// team of that sub-role (the sweep). The first to take it handles it and the appraiser is told who. It
/// never returns to the appraiser on its own; an end-of-day reminder goes to both sides while it is open.</item>
/// <item>Peer transfer: he offers his transaction to a colleague or asks a colleague for his; it moves
/// when the other one accepts, and only whoever handed the transaction over at its stage is told.</item>
/// </list>
/// Both end in the same seat move as «تعديل الأطراف» (<see cref="IWorkflowTaskDistributionCommands.ReassignAppraiserAsync"/>):
/// the work stays, the new appraiser approves himself, the timeline keeps the first one.
/// Edge cases: nothing moves after the appraiser approved the report or after the final issuance (the
/// path then is «التعديل»); one open request per task; notices are best effort.
/// </remarks>
public sealed class AppraiserHandoverService(
    IAppraiserHandoverRepository repo,
    IWorkflowTaskDistributionCommands distribution,
    INotificationService notifications,
    INotificationRecipientResolver recipients,
    TimeProvider? time = null,
    IValuationRequestService? valuationRequests = null) : IAppraiserHandoverService
{
    /// <summary>Working minutes the handing person has the request alone before the team sees it.</summary>
    public const int HeadStartWorkingMinutes = 5;

    /// <summary>The end-of-day reminder goes out in the last minutes of the working day.</summary>
    public const int ReminderMinutesBeforeDayEnd = 30;

    public const string NotAppraiserAr = "طلبات إعادة الإسناد والتحويل للمقيّم المُسنَد فقط.";
    public const string NotAssignedAr = "التقييم ليس مُسنَدًا لك.";
    public const string AlreadyOpenAr = "يوجد طلب مفتوح لهذا التقييم — ألغِه أولًا.";
    public const string LockedAfterApprovalAr =
        "اعتمد المقيّم التقرير — لا يُنقل التقييم الآن؛ بعد الإيداع يكون عبر «التعديل».";
    public const string ReasonRequiredAr = "سبب طلب إعادة الإسناد مطلوب.";
    public const string NotFoundAr = "الطلب غير موجود أو أُغلق.";
    public const string NotHandlerAr = "هذا الطلب لمن سلّم المعاملة للمقيّم أو لفريقه.";
    public const string NotPeerAr = "هذا الطلب ليس موجّهًا إليك.";
    public const string NotRequesterAr = "يلغي الطلب من رفعه فقط.";
    public const string PeerSelfAr = "اختر مقيّمًا آخر.";

    private readonly TimeProvider _time = time ?? TimeProvider.System;

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> RequestReassignmentAsync(
        RequestAppraiserReassignmentRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var reason = (request.Reason ?? "").Trim();
        if (reason.Length == 0) return (null, Error(ReasonRequiredAr));
        var (task, refusal) = await LoadMovableTaskAsync(request.AppraisalTaskId, actor, mustHold: true, cancellationToken);
        if (task is null) return (null, refusal);

        var (subRole, handingUserId) = await HandlerOfAsync(task, cancellationToken);
        var now = _time.GetUtcNow().UtcDateTime;
        var entity = AppraiserHandoverRequest.Reassign(
            task.Id, task.PropertyId, task.PoNumber, reason, actor.UserId, actor.DisplayName,
            actor.DistributionAssigneeId!, subRole, handingUserId, now);
        await repo.AddAsync(entity, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);

        var first = handingUserId is null
            ? await TeamOfAsync(subRole, cancellationToken)
            : [handingUserId];
        await NotifyAsync(first, entity, "طلب إعادة إسناد تقييم",
            $"يطلب المقيّم {entity.RequestedByName} إعادة إسناد تقييم أمر العمل {entity.PoNumber}: {entity.Reason}",
            NotificationContract.Tones.Warn, "requested", cancellationToken, toStaff: true);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> RequestPeerTransferAsync(
        RequestPeerTransferRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var direction = (request.Direction ?? "").Trim();
        if (direction is not (AppraiserHandoverDirections.Offer or AppraiserHandoverDirections.Ask))
            return (null, Error("اختر: تحويل تقييمك لزميل، أو طلب تقييم زميل."));
        var peer = (request.PeerAssigneeId ?? "").Trim();
        if (peer.Length == 0 || string.Equals(peer, actor.DistributionAssigneeId?.Trim(), StringComparison.Ordinal))
            return (null, Error(PeerSelfAr));

        // Offer: the caller holds the seat. Ask: the colleague holds it.
        var offer = direction == AppraiserHandoverDirections.Offer;
        var (task, refusal) = await LoadMovableTaskAsync(request.AppraisalTaskId, actor, mustHold: offer, cancellationToken);
        if (task is null) return (null, refusal);
        if (!offer && !string.Equals(task.AssigneeId?.Trim(), peer, StringComparison.Ordinal))
            return (null, Error("التقييم ليس مُسنَدًا لهذا الزميل."));

        var now = _time.GetUtcNow().UtcDateTime;
        var entity = AppraiserHandoverRequest.Peer(
            task.Id, task.PropertyId, task.PoNumber, direction, request.Reason, actor.UserId, actor.DisplayName,
            actor.DistributionAssigneeId!, peer, request.PeerName, now);
        await repo.AddAsync(entity, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);

        var peerUser = await UserOfAssigneeAsync(peer, cancellationToken);
        await NotifyAsync(peerUser is null ? [] : [peerUser], entity,
            offer ? "عرض تحويل تقييم إليك" : "طلب تحويل تقييمك",
            offer
                ? $"يعرض المقيّم {entity.RequestedByName} تحويل تقييم أمر العمل {entity.PoNumber} إليك — اقبل أو اعتذر."
                : $"يطلب المقيّم {entity.RequestedByName} تحويل تقييمك في أمر العمل {entity.PoNumber} إليه — اقبل أو اعتذر.",
            NotificationContract.Tones.Info, "peer-requested", cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> TakeAsync(
        Guid id,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null || entity.Kind != AppraiserHandoverKinds.Reassign || !entity.IsOpen)
            return (null, Error(NotFoundAr));
        if (!MayHandle(entity, actor)) return (null, Error(NotHandlerAr));
        if (entity.Status == AppraiserHandoverStatuses.Taken)
            return string.Equals(entity.TakenByUserId, actor.UserId, StringComparison.Ordinal)
                ? (ToDto(entity), null)
                : (null, Error($"استلم الطلب {entity.TakenByName}."));

        entity.TryTake(actor.UserId, actor.DisplayName, _time.GetUtcNow().UtcDateTime);
        await repo.SaveChangesAsync(cancellationToken);
        await NotifyAsync([entity.RequestedByUserId], entity, "استُلم طلب إعادة الإسناد",
            $"استلم {actor.DisplayName} طلبك لإعادة إسناد تقييم أمر العمل {entity.PoNumber}.",
            NotificationContract.Tones.Info, "taken", cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> CompleteReassignmentAsync(
        Guid id,
        CompleteAppraiserReassignmentRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null || entity.Kind != AppraiserHandoverKinds.Reassign || !entity.IsOpen)
            return (null, Error(NotFoundAr));
        if (!MayHandle(entity, actor)) return (null, Error(NotHandlerAr));
        if (entity.Status == AppraiserHandoverStatuses.Taken
            && !string.Equals(entity.TakenByUserId, actor.UserId, StringComparison.Ordinal)
            && !WorkflowTaskLifecycleRules.CanRedistributeParties(actor.Staff))
            return (null, Error($"استلم الطلب {entity.TakenByName}."));
        var newAssignee = (request.NewAssigneeId ?? "").Trim();
        if (newAssignee.Length == 0 || newAssignee == entity.RequestedByAssigneeId)
            return (null, Error("اختر المقيّم الجديد."));
        if (await ApprovedOrFinalAsync(entity.AppraisalTaskId, cancellationToken))
            return (null, Error(LockedAfterApprovalAr));

        var moveErrors = await distribution.ReassignAppraiserAsync(
            entity.AppraisalTaskId, newAssignee, request.NewAssigneeName, entity.Reason, actor.Staff,
            actor.DisplayName, actor.UserId, cancellationToken);
        if (moveErrors is { Count: > 0 }) return (null, new Dictionary<string, string>(moveErrors));

        var now = _time.GetUtcNow().UtcDateTime;
        if (entity.Status == AppraiserHandoverStatuses.Pending)
            entity.TryTake(actor.UserId, actor.DisplayName, now);
        entity.TryClose(AppraiserHandoverStatuses.Done, actor.UserId, actor.DisplayName, request.NewAssigneeName, now);
        await repo.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> AcceptPeerAsync(
        Guid id,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null || entity.Kind != AppraiserHandoverKinds.Peer || !entity.IsOpen)
            return (null, Error(NotFoundAr));
        if (!string.Equals(entity.PeerAcceptorAssigneeId, actor.DistributionAssigneeId?.Trim(), StringComparison.Ordinal))
            return (null, Error(NotPeerAr));
        var task = await repo.GetTaskAsync(entity.AppraisalTaskId, cancellationToken);
        if (task is null) return (null, Error(NotFoundAr));
        if (await ApprovedOrFinalAsync(entity.AppraisalTaskId, cancellationToken))
            return (null, Error(LockedAfterApprovalAr));

        var receiver = entity.PeerReceiverAssigneeId!;
        var receiverName = entity.Direction == AppraiserHandoverDirections.Offer ? actor.DisplayName : entity.RequestedByName;
        var reason = entity.Reason.Length > 0 ? entity.Reason : "تحويل بين المقيّمين بالتراضي";
        var moveErrors = await distribution.ReassignAppraiserAsync(
            entity.AppraisalTaskId, receiver, receiverName, reason, actor.Staff, actor.DisplayName, actor.UserId,
            cancellationToken);
        if (moveErrors is { Count: > 0 }) return (null, new Dictionary<string, string>(moveErrors));

        entity.TryClose(AppraiserHandoverStatuses.Done, actor.UserId, actor.DisplayName, null, _time.GetUtcNow().UtcDateTime);
        await repo.SaveChangesAsync(cancellationToken);

        // Only whoever handed the transaction over at its stage hears of it (and the requester).
        var (_, handingUserId) = await HandlerOfAsync(task, cancellationToken);
        var told = new List<string> { entity.RequestedByUserId };
        if (handingUserId is not null) told.Add(handingUserId);
        await NotifyAsync(told, entity, "تحويل تقييم بين المقيّمين",
            $"انتقل تقييم أمر العمل {entity.PoNumber} إلى المقيّم {receiverName} بالتراضي.",
            NotificationContract.Tones.Info, "peer-accepted", cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> DeclinePeerAsync(
        Guid id,
        CloseAppraiserHandoverRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null || entity.Kind != AppraiserHandoverKinds.Peer || !entity.IsOpen)
            return (null, Error(NotFoundAr));
        if (!string.Equals(entity.PeerAcceptorAssigneeId, actor.DistributionAssigneeId?.Trim(), StringComparison.Ordinal))
            return (null, Error(NotPeerAr));
        entity.TryClose(AppraiserHandoverStatuses.Declined, actor.UserId, actor.DisplayName, request.Note,
            _time.GetUtcNow().UtcDateTime);
        await repo.SaveChangesAsync(cancellationToken);
        await NotifyAsync([entity.RequestedByUserId], entity, "اعتذر الزميل عن التحويل",
            $"اعتذر {actor.DisplayName} عن تحويل تقييم أمر العمل {entity.PoNumber}.",
            NotificationContract.Tones.Warn, "peer-declined", cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors)> CancelAsync(
        Guid id,
        CloseAppraiserHandoverRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null || !entity.IsOpen) return (null, Error(NotFoundAr));
        if (!string.Equals(entity.RequestedByUserId, actor.UserId, StringComparison.Ordinal))
            return (null, Error(NotRequesterAr));
        entity.TryClose(AppraiserHandoverStatuses.Cancelled, actor.UserId, actor.DisplayName, request.Note,
            _time.GetUtcNow().UtcDateTime);
        await repo.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<IReadOnlyList<AppraiserHandoverRequestDto>> ListOpenAsync(
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        if (IsAppraiser(actor))
        {
            var mine = actor.DistributionAssigneeId?.Trim();
            if (string.IsNullOrEmpty(mine)) return [];
            return (await repo.ListOpenForAppraiserAsync(mine, cancellationToken)).Select(ToDto).ToList();
        }
        var open = await repo.ListOpenAsync(cancellationToken);
        return open.Where(r => r.Kind == AppraiserHandoverKinds.Reassign && MayHandle(r, actor)).Select(ToDto).ToList();
    }

    public async Task SweepAsync(CancellationToken cancellationToken = default)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var open = await repo.ListOpenAsync(cancellationToken);
        if (open.Count == 0) return;
        var (nearEnd, today) = WorkCalendar.IsNearDayEnd(now, ReminderMinutesBeforeDayEnd);
        var changed = false;
        foreach (var r in open)
        {
            if (r.Kind == AppraiserHandoverKinds.Reassign
                && r.Status == AppraiserHandoverStatuses.Pending
                && r.EscalatedAtUtc is null
                && now >= WorkCalendar.AddWorkingMinutes(r.RequestedAtUtc, HeadStartWorkingMinutes)
                && r.TryEscalate(now))
            {
                changed = true;
                var team = (await TeamOfAsync(r.HandlerSubRole!, cancellationToken))
                    .Where(u => !string.Equals(u, r.HandingUserId, StringComparison.Ordinal))
                    .ToList();
                await NotifyAsync(team, r, "طلب إعادة إسناد تقييم بانتظار من يستلمه",
                    $"لم يُستلم بعد طلب المقيّم {r.RequestedByName} لإعادة إسناد تقييم أمر العمل {r.PoNumber}: {r.Reason}",
                    NotificationContract.Tones.Warn, "escalated", cancellationToken, toStaff: true);
            }

            if (nearEnd && r.RemindedOn != today)
            {
                r.RemindedOn = today;
                changed = true;
                await RemindAsync(r, cancellationToken);
            }
        }
        if (changed) await repo.SaveChangesAsync(cancellationToken);
    }

    /// <summary>The end-of-day reminder to both sides of an open request.</summary>
    private async Task RemindAsync(AppraiserHandoverRequest r, CancellationToken cancellationToken)
    {
        var state = r.Status == AppraiserHandoverStatuses.Taken
            ? $"استلمه {r.TakenByName} ولم يُنفَّذ بعد"
            : "لم يُستلم بعد";
        await NotifyAsync([r.RequestedByUserId], r, "تذكير: طلبك ما زال مفتوحًا",
            $"طلبك على تقييم أمر العمل {r.PoNumber} {state} — يمكنك إلغاؤه والتحويل لزميل.",
            NotificationContract.Tones.Warn, "reminder", cancellationToken);

        List<string> other;
        if (r.Kind == AppraiserHandoverKinds.Peer)
        {
            var peer = await UserOfAssigneeAsync(r.PeerAssigneeId!, cancellationToken);
            other = peer is null ? [] : [peer];
        }
        else if (r.Status == AppraiserHandoverStatuses.Taken && r.TakenByUserId is not null)
            other = [r.TakenByUserId];
        else if (r.EscalatedAtUtc is null && r.HandingUserId is not null)
            other = [r.HandingUserId];
        else
            other = (await TeamOfAsync(r.HandlerSubRole!, cancellationToken)).ToList();
        await NotifyAsync(other, r, "تذكير: طلب على تقييم ما زال مفتوحًا",
            $"طلب المقيّم {r.RequestedByName} على تقييم أمر العمل {r.PoNumber} {state}.",
            NotificationContract.Tones.Warn, "reminder", cancellationToken,
            toStaff: r.Kind == AppraiserHandoverKinds.Reassign);
    }

    /// <summary>
    /// The appraisal task when the actor may move it: an appraiser, the task live, no open request, and
    /// the report not approved or issued.
    /// </summary>
    private async Task<(WorkflowTask? Task, Dictionary<string, string>? Errors)> LoadMovableTaskAsync(
        Guid taskId,
        PartySubmissionActor actor,
        bool mustHold,
        CancellationToken cancellationToken)
    {
        if (!IsAppraiser(actor) || string.IsNullOrWhiteSpace(actor.DistributionAssigneeId))
            return (null, Error(NotAppraiserAr));
        var task = await repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null || task.Kind != WorkflowTaskKind.PropertyAppraisal || task.Status == WorkflowTaskStatus.Cancelled)
            return (null, Error("مهمة التقييم غير موجودة."));
        if (mustHold && !string.Equals(task.AssigneeId?.Trim(), actor.DistributionAssigneeId.Trim(), StringComparison.Ordinal))
            return (null, Error(NotAssignedAr));
        if (await repo.FindOpenForTaskAsync(task.Id, cancellationToken) is not null)
            return (null, Error(AlreadyOpenAr));
        if (await ApprovedOrFinalAsync(task.Id, cancellationToken))
            return (null, Error(LockedAfterApprovalAr));
        return (task, null);
    }

    /// <summary>
    /// The appraiser approved the report (deposit copy issued) or the final copy is out — nothing moves.
    /// No valuation link: not known, so not refused.
    /// </summary>
    private async Task<bool> ApprovedOrFinalAsync(Guid taskId, CancellationToken cancellationToken)
    {
        if (valuationRequests is null) return false;
        var task = await repo.GetTaskAsync(taskId, cancellationToken);
        if (task?.PropertyId is not Guid propertyId) return false;
        var open = await valuationRequests.GetOpenByPropertyAsync(propertyId.ToString("D"), cancellationToken);
        if (open is null) return task.Status == WorkflowTaskStatus.Completed;
        return open.ReportStage is ValuationReportStageWire.DepositIssued or ValuationReportStageWire.FinalIssued;
    }

    /// <summary>
    /// Who handed the transaction to the appraiser at its current stage: once he handed his value over,
    /// review (the reviewer who approved the study and sent the draft, else who accepted his value); before
    /// that, the study (the specialist who issued the study). Null person → the team has it from the start.
    /// </summary>
    private async Task<(string SubRole, string? HandingUserId)> HandlerOfAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        var submission = await repo.GetSubmissionAsync(task.Id, cancellationToken);
        var transaction = task.PropertyId is Guid propertyId
            ? await repo.GetTransactionForPropertyAsync(propertyId, cancellationToken)
            : null;
        if (submission?.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return (CaseSpecialistSubRoles.Review,
                Texts.NullIfBlank(transaction?.ReviewApprovedByUserId) ?? Texts.NullIfBlank(submission.AcceptedByUserId));
        }
        return (CaseSpecialistSubRoles.Study, Texts.NullIfBlank(transaction?.HandedToReviewByUserId));
    }

    /// <summary>
    /// Whether the actor may take and complete a reassignment request: its sub-role's team once it widened,
    /// only the handing person before; the section supervisor (and coordination, who redistributes the
    /// parties) always.
    /// </summary>
    private static bool MayHandle(AppraiserHandoverRequest r, PartySubmissionActor actor)
    {
        if (WorkflowTaskLifecycleRules.CanRedistributeParties(actor.Staff)) return true;
        if (string.Equals(r.HandingUserId, actor.UserId, StringComparison.Ordinal)) return true;
        return r.EscalatedAtUtc is not null && r.HandlerSubRole is { } subRole && actor.Staff.Holds(subRole);
    }

    private static bool IsAppraiser(PartySubmissionActor actor) =>
        actor.Staff.NormalizedRole == StaffRoleIds.RealEstateAppraiser;

    private async Task<IReadOnlyList<string>> TeamOfAsync(string subRole, CancellationToken cancellationToken)
    {
        try
        {
            return await recipients.ResolveCaseSpecialistUserIdsAsync(subRole, cancellationToken);
        }
        catch
        {
            return [];
        }
    }

    private async Task<string?> UserOfAssigneeAsync(string assigneeId, CancellationToken cancellationToken)
    {
        try
        {
            return await recipients.ResolveUserIdForDistributionAssigneeAsync(assigneeId, cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Tells the users (best effort — the request already stands).</summary>
    private async Task NotifyAsync(
        IEnumerable<string> userIds,
        AppraiserHandoverRequest r,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken,
        bool toStaff = false)
    {
        var ids = userIds.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct(StringComparer.Ordinal).ToList();
        if (ids.Count == 0) return;
        try
        {
            await notifications.CreateForUsersAsync(ids, new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                // Staff open the work page (the request card); the appraisers the property page.
                Href = r.PropertyId is Guid propertyId
                    ? $"/po/{Uri.EscapeDataString(r.PoNumber)}/property/{propertyId:D}{(toStaff ? "/work" : "")}"
                    : null,
                Category = "workflow",
                EntityType = "AppraiserHandoverRequest",
                EntityId = r.Id.ToString("D"),
                SourceEvent = $"appraiser-handover.{sourceEvent}",
            }, cancellationToken);
        }
        catch
        {
            // Notices are best effort.
        }
    }

    private static AppraiserHandoverRequestDto ToDto(AppraiserHandoverRequest r) => new()
    {
        Id = r.Id.ToString("D"),
        Kind = r.Kind,
        Status = r.Status,
        AppraisalTaskId = r.AppraisalTaskId.ToString("D"),
        PropertyId = r.PropertyId?.ToString("D"),
        PoNumber = r.PoNumber,
        Reason = r.Reason,
        RequestedByName = r.RequestedByName,
        RequestedByAssigneeId = r.RequestedByAssigneeId,
        RequestedAtUtc = r.RequestedAtUtc.ToString("O"),
        HandlerSubRole = r.HandlerSubRole,
        Escalated = r.EscalatedAtUtc is not null,
        TakenByName = r.TakenByName,
        TakenAtUtc = r.TakenAtUtc?.ToString("O"),
        Direction = r.Direction,
        PeerAssigneeId = r.PeerAssigneeId,
        PeerName = r.PeerName,
    };
}
