using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OperationsTaskNotifier
{
    private readonly OperationsDbContext _ops;
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;

    public OperationsTaskNotifier(OperationsDbContext ops,
        ApplicationDbContext db, INotificationService notifications)
    {
        _ops = ops;
        _db = db;
        _notifications = notifications;
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

    public async Task NotifyCreatorOnCompletedAsync(
        OperationsTask entity,
        string actorUserId,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var creatorId = entity.CreatedBy.Trim();
        if (creatorId.Length == 0) return;
        if (string.Equals(creatorId, actorUserId.Trim(), StringComparison.Ordinal))
            return;

        var who = string.IsNullOrWhiteSpace(actorName) ? "المنفّذ" : actorName.Trim();
        await _notifications.CreateForUserAsync(
            creatorId,
            new CreateUserNotificationRequest
            {
                Title = "اكتملت المهمة",
                Body = $"أكمل {who} المهمة {entity.DisplayId}: {entity.Title}.",
                Tone = "success",
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"ops-task-done:{entity.Id}:{creatorId}",
            },
            cancellationToken);
    }

    public async Task NotifyPauseOverLimitAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
        var unix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
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
                    SourceEvent = $"ops-task-pause-limit:{entity.Id}:{unix}:assignee",
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
                    SourceEvent = $"ops-task-pause-limit:{entity.Id}:{unix}:creator",
                },
                cancellationToken);
        }
    }

    public async Task NotifyReminderAsync(
        OperationsTask entity,
        bool auto,
        CancellationToken cancellationToken)
    {
        var unix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
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
                    SourceEvent = $"ops-task-remind:{entity.Id}:{unix}:assignee",
                },
                cancellationToken);
        }

        // Auto reminders escalate to creator until close (دورة اسناد المهام §9).
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
                SourceEvent = $"ops-task-remind:{entity.Id}:{unix}:creator",
            },
            cancellationToken);
    }

    public async Task NotifyCourtVisitCompletedAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
        var pos = new HashSet<string>(StringComparer.Ordinal);
        var primary = entity.PoNumber?.Trim();
        if (!string.IsNullOrEmpty(primary)) pos.Add(primary);
        foreach (var row in OperationsTaskSerialization.DeserializeLetterRows(entity.LetterRowsJson))
        {
            var p = row.Po?.Trim();
            if (!string.IsNullOrEmpty(p)) pos.Add(p);
        }
        if (pos.Count == 0) return;

        var userIds = await (
                from task in _db.WorkflowTasks.AsNoTracking()
                join profile in _db.UserProfiles.AsNoTracking()
                    on task.AssigneeId equals profile.DistributionAssigneeId
                where task.PoNumber != null
                      && pos.Contains(task.PoNumber)
                      && task.Kind == WorkflowTaskKind.GovernmentReview
                      && task.Status != WorkflowTaskStatus.Completed
                      && task.Status != WorkflowTaskStatus.Cancelled
                      && task.AssigneeId != null
                      && task.AssigneeId != ""
                select profile.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (userIds.Count == 0) return;

        var poLabel = string.Join("، ", pos);
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

        var fromDb = await PersonLabelResolver.ResolveAsync(_db, userId, cancellationToken);
        return PersonLabelResolver.LooksLikePersonName(fromDb) ? fromDb : "";
    }

    private async Task<string?> ResolveUserIdForAssigneeAsync(
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        var id = assigneeId?.Trim() ?? "";
        if (id.Length == 0) return null;

        var userId = await _db.UserProfiles.AsNoTracking()
            .Where(p => p.DistributionAssigneeId == id)
            .Select(p => p.UserId)
            .FirstOrDefaultAsync(cancellationToken);

        return string.IsNullOrWhiteSpace(userId) ? null : userId;
    }

    private static string OperationsTaskHref(Guid id) => $"/operations-tasks?task={id}";
}
