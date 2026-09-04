using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

/// <summary>
/// Notification side of the operations-task use cases. Pure orchestration over the identity
/// directory and the notification port — it never opened a DbContext, so it moved out of
/// Infrastructure whole (solid-scorecard finding 1).
/// </summary>
public sealed class OperationsTaskNotifier
{
    private static readonly string[] StakeholderRoles =
    [
        StaffRoleIds.SectionSupervisor,
 // general managers often oversee case study — keep in ops lifecycle loop
        StaffRoleIds.GeneralManager,
    ];

    private readonly IIdentityDirectory _identity;
    private readonly INotificationService _notifications;
    private readonly IUserLabelLookup _labels;
    private readonly TimeProvider _time;

    // A8: the IdentityDbContext convenience ctor is gone — pass IIdentityDirectory + IUserLabelLookup.

    [ActivatorUtilitiesConstructor]
    public OperationsTaskNotifier(
        IIdentityDirectory identity,
        INotificationService notifications,
        IUserLabelLookup labels,
        TimeProvider? time = null)
    {
        _identity = identity;
        _notifications = notifications;
        _labels = labels;
        _time = time ?? TimeProvider.System;
    }

    public async Task NotifyAssigneeAsync(OperationsTask entity, CancellationToken cancellationToken)
    {
        var userId = await ResolveUserIdForAssigneeAsync(entity.AssigneeId, cancellationToken);
        if (userId is null) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "مهمة جديدة بانتظارك",
                Body = $"أُسندت إليك مهمة {entity.DisplayId}: {entity.Title}.",
                Tone = "info",
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"ops-task-assigned:{entity.Id}",
            },
            cancellationToken);
    }

 /// <summary>
 /// When the assignee confirms receipt (created → in_progress): creator + supervisors.
 /// </summary>
    public async Task NotifyStakeholdersOnReceiptAsync(
        OperationsTask entity,
        string? actorName,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        var who = string.IsNullOrWhiteSpace(actorName) ? "المنفّذ" : actorName.Trim();
        await NotifyStakeholdersAsync(
            entity,
            title: "تأكيد استلام المهمة",
            body: $"أكّد {who} استلام المهمة {entity.DisplayId}: {entity.Title}.",
            tone: "info",
            sourceEvent: $"ops-task-receipt:{entity.Id}",
            excludeUserId,
            cancellationToken);
    }

 /// <summary>
 /// When the task is completed: creator + supervisors (and general manager).
 /// </summary>
    public async Task NotifyCreatorOnCompletedAsync(
        OperationsTask entity,
        string actorUserId,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var who = string.IsNullOrWhiteSpace(actorName) ? "المنفّذ" : actorName.Trim();
        await NotifyStakeholdersAsync(
            entity,
            title: "اكتملت المهمة",
            body: $"أكمل {who} المهمة {entity.DisplayId}: {entity.Title}.",
            tone: "success",
            sourceEvent: $"ops-task-done:{entity.Id}",
            excludeUserId: actorUserId,
            cancellationToken);
    }

 /// <summary>Task cancelled by manager → notify the assignee.</summary>
    public async Task NotifyAssigneeOnCancelledAsync(
        OperationsTask entity,
        string? actorName,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        var who = string.IsNullOrWhiteSpace(actorName) ? "المسؤول" : actorName.Trim();
        var reason = string.IsNullOrWhiteSpace(entity.CancelReason)
            ? ""
            : $" السبب: {entity.CancelReason.Trim()}";
        await NotifyAssigneeOnlyAsync(
            entity,
            title: "أُلغيت المهمة",
            body: $"ألغى {who} المهمة {entity.DisplayId}: {entity.Title}.{reason}",
            tone: "warning",
            sourceEvent: $"ops-task-cancelled:{entity.Id}",
            excludeUserId,
            cancellationToken);
    }

 /// <summary>Priority and/or due date changed → notify the assignee.</summary>
    public async Task NotifyAssigneeOnScheduleChangedAsync(
        OperationsTask entity,
        bool priorityChanged,
        bool dueChanged,
        string? actorName,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        if (!priorityChanged && !dueChanged) return;

        var who = string.IsNullOrWhiteSpace(actorName) ? "المسؤول" : actorName.Trim();
        var parts = new List<string>();
        if (priorityChanged)
            parts.Add($"الأولوية «{entity.Priority.ToArabicLabel()}»");
        if (dueChanged)
            parts.Add($"موعد الاستحقاق {OperationsTaskSerialization.FormatDueLabel(entity.DueAtUtc)}");

        await NotifyAssigneeOnlyAsync(
            entity,
            title: "تحديث على المهمة",
            body: $"حدّث {who} المهمة {entity.DisplayId}: {string.Join(" و ", parts)}.",
            tone: "info",
            sourceEvent: $"ops-task-schedule:{entity.Id}:{_time.GetUtcNow().ToUnixTimeSeconds()}",
            excludeUserId,
            cancellationToken);
    }

 /// <summary>
 /// New human comment: notify the other party (assignee ↔ creator).
 /// </summary>
    public async Task NotifyCounterpartyOnCommentAsync(
        OperationsTask entity,
        string commenterSide,
        string? actorName,
        string? commentPreview,
        CancellationToken cancellationToken)
    {
        var who = string.IsNullOrWhiteSpace(actorName) ? "المستخدم" : actorName.Trim();
        var preview = (commentPreview ?? "").Trim();
        if (preview.Length > 120)
            preview = preview[..117] + "…";
        var bodyTail = preview.Length > 0 ? $": {preview}" : ".";

        var side = commenterSide.Trim().ToLowerInvariant();
        if (side == "assignee")
        {
            var creatorId = entity.CreatedBy.Trim();
            if (creatorId.Length == 0) return;
            await _notifications.CreateForUserAsync(
                creatorId,
                new CreateUserNotificationRequest
                {
                    Title = "تحديث على المهمة",
                    Body = $"علّق {who} على المهمة {entity.DisplayId}{bodyTail}",
                    Tone = "info",
                    Href = OperationsTaskHref(entity.Id),
                    Category = "workflow",
                    EntityType = "operations-task",
                    EntityId = entity.Id.ToString(),
                    SourceEvent =
                        $"ops-task-comment:{entity.Id}:{_time.GetUtcNow().ToUnixTimeSeconds()}:creator",
                },
                cancellationToken);
            return;
        }

 // creator / manager → notify assignee
        await NotifyAssigneeOnlyAsync(
            entity,
            title: "تحديث على المهمة",
            body: $"علّق {who} على المهمة {entity.DisplayId}{bodyTail}",
            tone: "info",
            sourceEvent:
                $"ops-task-comment:{entity.Id}:{_time.GetUtcNow().ToUnixTimeSeconds()}:assignee",
            excludeUserId: null,
            cancellationToken);
    }

    public async Task NotifyPauseOverLimitAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
 // Recurring per cadence for the same task+reason → stable SourceEvent (no timestamp),
 // so re-emits refresh the still-unread row via IX_UserNotifications_UserId_SourceEvent_Unread
 // instead of stacking duplicates in the activity feed.
        var body = $"المهمة {entity.DisplayId} متوقفة مؤقتاً لأكثر من يوم عمل — يلزم الاستئناف.";
        var href = OperationsTaskHref(entity.Id);

        var assigneeUserId = await ResolveUserIdForAssigneeAsync(entity.AssigneeId, cancellationToken);
        if (assigneeUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                assigneeUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تجاوز حد الإيقاف المؤقت",
                    Body = body,
                    Tone = "warning",
                    Href = href,
                    Category = "workflow",
                    EntityType = "operations-task",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"ops-task-pause-limit:{entity.Id}:assignee",
                },
                cancellationToken);
        }

        var creatorId = entity.CreatedBy.Trim();
        if (creatorId.Length > 0
            && !string.Equals(creatorId, assigneeUserId, StringComparison.Ordinal))
        {
            await _notifications.CreateForUserAsync(
                creatorId,
                new CreateUserNotificationRequest
                {
                    Title = "تجاوز حد الإيقاف المؤقت",
                    Body = body,
                    Tone = "warning",
                    Href = href,
                    Category = "workflow",
                    EntityType = "operations-task",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"ops-task-pause-limit:{entity.Id}:creator",
                },
                cancellationToken);
        }
    }

    public async Task NotifyReminderAsync(
        OperationsTask entity,
        bool auto,
        CancellationToken cancellationToken)
    {
 // Reminders repeat on the work-hours cadence until the task closes. The message is the
 // same each time, so the SourceEvent must stay stable (no timestamp): while the previous
 // reminder is still unread, NotificationService refreshes it in place
 // (IX_UserNotifications_UserId_SourceEvent_Unread) instead of piling up duplicate
 // "Task Reminder" rows in the activity feed. A new row only appears after the user reads
 // the previous one.
        var body = $"تذكير بالمهمة {entity.DisplayId}: {entity.Title}.";
        var href = OperationsTaskHref(entity.Id);

        var assigneeUserId = await ResolveUserIdForAssigneeAsync(entity.AssigneeId, cancellationToken);
        if (assigneeUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                assigneeUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تذكير بمهمة",
                    Body = body,
                    Tone = "warning",
                    Href = href,
                    Category = "workflow",
                    EntityType = "operations-task",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"ops-task-remind:{entity.Id}:assignee",
                },
                cancellationToken);
        }

 // Auto reminders escalate to creator until close (assignment cycle).
        if (!auto) return;

        var creatorId = entity.CreatedBy.Trim();
        if (creatorId.Length == 0
            || string.Equals(creatorId, assigneeUserId, StringComparison.Ordinal))
            return;

        await _notifications.CreateForUserAsync(
            creatorId,
            new CreateUserNotificationRequest
            {
                Title = "تذكير بمهمة",
                Body = body,
                Tone = "warning",
                Href = href,
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"ops-task-remind:{entity.Id}:creator",
            },
            cancellationToken);
    }

    public async Task NotifyCourtVisitCompletedAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
 // Notify active government-reviewers by role (court visits), not legacy GR workflow assignees.
        var userIds = await _identity.ResolveUserIdsWithPrototypeRoleAsync(
            "government-reviewer",
            cancellationToken);
        if (userIds.Count == 0) return;

        var pos = new HashSet<string>(StringComparer.Ordinal);
        var primary = entity.PoNumber?.Trim();
        if (!string.IsNullOrEmpty(primary)) pos.Add(primary);
        foreach (var row in OperationsTaskSerialization.DeserializeLetterRows(entity.LetterRowsJson))
        {
            var p = row.Po?.Trim();
            if (!string.IsNullOrEmpty(p)) pos.Add(p);
        }
        var poLabel = pos.Count > 0 ? string.Join("، ", pos) : entity.DisplayId;

        await _notifications.CreateForUsersAsync(
            userIds,
            new CreateUserNotificationRequest
            {
                Title = "زيارة محكمة مكتملة",
                Body =
                    $"اكتملت زيارة المحكمة ({entity.DisplayId}) لأمر العمل {poLabel}.",
                Tone = "success",
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"ops-task-court-done:{entity.Id}",
            },
            cancellationToken);
    }

    public async Task<string> ResolveActorDisplayNameAsync(
        string userId,
        string? claimName,
        CancellationToken cancellationToken)
    {
        if (PersonLabelResolver.LooksLikePersonName(claimName))
            return claimName!.Trim();

        var fromDb = await _labels.ResolveAsync(userId, cancellationToken);
        return PersonLabelResolver.LooksLikePersonName(fromDb) ? fromDb : "";
    }

    private async Task NotifyAssigneeOnlyAsync(
        OperationsTask entity,
        string title,
        string body,
        string tone,
        string sourceEvent,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        var userId = await ResolveUserIdForAssigneeAsync(entity.AssigneeId, cancellationToken);
        if (userId is null) return;
        var exclude = excludeUserId?.Trim() ?? "";
        if (exclude.Length > 0
            && string.Equals(userId, exclude, StringComparison.Ordinal))
            return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    private async Task NotifyStakeholdersAsync(
        OperationsTask entity,
        string title,
        string body,
        string tone,
        string sourceEvent,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        var userIds = await CollectStakeholderUserIdsAsync(entity, excludeUserId, cancellationToken);
        if (userIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            userIds,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

 /// <summary>
 /// Task creator (typically specialist/supervisor) + active section supervisors / GMs.
 /// </summary>
    private async Task<IReadOnlyList<string>> CollectStakeholderUserIdsAsync(
        OperationsTask entity,
        string? excludeUserId,
        CancellationToken cancellationToken)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var creatorId = entity.CreatedBy.Trim();
        if (creatorId.Length > 0)
            ids.Add(creatorId);

        foreach (var id in await ResolveStakeholderRoleUserIdsAsync(cancellationToken))
        {
            if (!string.IsNullOrWhiteSpace(id))
                ids.Add(id);
        }

        var exclude = excludeUserId?.Trim() ?? "";
        if (exclude.Length > 0)
            ids.Remove(exclude);

        return ids.ToList();
    }

    private IReadOnlyList<string>? _stakeholderRoleUserIds;

 /// <summary>One call for each role in the scope of the order — a reminder was repeated for each task.</summary>
    private async Task<IReadOnlyList<string>> ResolveStakeholderRoleUserIdsAsync(
        CancellationToken cancellationToken)
    {
        if (_stakeholderRoleUserIds is not null) return _stakeholderRoleUserIds;
        var ids = new List<string>();
        foreach (var role in StakeholderRoles)
        {
            ids.AddRange(await _identity.ResolveUserIdsWithPrototypeRoleAsync(
                role,
                cancellationToken));
        }
        _stakeholderRoleUserIds = ids;
        return ids;
    }

    private async Task<string?> ResolveUserIdForAssigneeAsync(
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        var id = assigneeId?.Trim() ?? "";
        if (id.Length == 0) return null;

        var userId = await _identity.ResolveUserIdForDistributionAssigneeAsync(
            id,
            cancellationToken);

        return string.IsNullOrWhiteSpace(userId) ? null : userId;
    }

    private static string OperationsTaskHref(Guid id) => $"/operations-tasks?task={id}";
}

