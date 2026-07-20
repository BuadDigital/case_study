using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OperationsTaskService : IOperationsTaskService
{
    private static readonly HashSet<string> ValidTypes =
    [
        "court_visit", "reshoot", "field_visit", "inquiry", "general",
    ];

    private static readonly HashSet<string> ValidScopes =
    [
        "transaction", "work_order", "multi", "general",
    ];

    private static readonly HashSet<string> ValidStatuses =
    [
        "created", "in_progress", "paused", "completed", "cancelled",
    ];

    private static readonly HashSet<string> ValidPriorities =
    [
        "high", "medium", "low",
    ];

    private static readonly HashSet<string> TerminalStatuses =
    [
        "completed", "cancelled",
    ];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;

    public OperationsTaskService(ApplicationDbContext db, INotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    public async Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var query = _db.OperationsTasks.AsNoTracking();

        var assignee = assigneeId?.Trim();
        if (!string.IsNullOrEmpty(assignee))
            query = query.Where(t => t.AssigneeId == assignee);

        var creator = createdBy?.Trim();
        if (!string.IsNullOrEmpty(creator))
            query = query.Where(t => t.CreatedBy == creator);

        var statusFilter = status?.Trim();
        if (!string.IsNullOrEmpty(statusFilter))
            query = query.Where(t => t.Status == statusFilter);

        if (!IsManager(actorRole))
        {
            var userId = actorUserId.Trim();
            var myAssignee = actorAssigneeId?.Trim() ?? "";
            var relatedPos = myAssignee.Length == 0
                ? new List<string>()
                : await _db.WorkflowTasks.AsNoTracking()
                    .Where(t => t.AssigneeId == myAssignee && t.PoNumber != null && t.PoNumber != "")
                    .Select(t => t.PoNumber!)
                    .Distinct()
                    .ToListAsync(cancellationToken);

            if (relatedPos.Count == 0)
            {
                query = query.Where(t =>
                    (myAssignee.Length > 0 && t.AssigneeId == myAssignee)
                    || (userId.Length > 0 && t.CreatedBy == userId));
            }
            else
            {
                query = query.Where(t =>
                    (myAssignee.Length > 0 && t.AssigneeId == myAssignee)
                    || (userId.Length > 0 && t.CreatedBy == userId)
                    || (t.PoNumber != null && relatedPos.Contains(t.PoNumber)));
            }
        }

        var rows = await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return rows.Select(Map).ToList();
    }

    public async Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.OperationsTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        return row is null ? null : Map(row);
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> CreateAsync(
        CreateOperationsTaskRequest request,
        string createdBy,
        string? createdByName,
        CancellationToken cancellationToken = default)
    {
        var type = request.Type.Trim();
        if (!ValidTypes.Contains(type))
            return (null, "نوع المهمة غير مدعوم");

        var scope = request.Scope.Trim();
        if (!ValidScopes.Contains(scope))
            return (null, "نطاق الربط غير مدعوم");

        var assigneeId = request.AssigneeId.Trim();
        if (assigneeId.Length == 0)
            return (null, "المنفّذ مطلوب");

        var title = request.Title.Trim();
        if (title.Length == 0)
            return (null, "العنوان مطلوب");

        var priority = string.IsNullOrWhiteSpace(request.Priority)
            ? "medium"
            : request.Priority.Trim();
        if (!ValidPriorities.Contains(priority))
            return (null, "الأولوية غير مدعومة");

        var deeds = (request.Deeds ?? [])
            .Select(d => d.Trim())
            .Where(d => d.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var poNumber = request.PoNumber?.Trim();
        var validationError = ValidateScope(scope, deeds, poNumber);
        if (validationError is not null)
            return (null, validationError);

        var now = DateTime.UtcNow;
        var dueAt = request.DueAtUtc ?? DefaultDueAt(priority, now);

        var letterRows = request.LetterRows?.ToList() ?? [];
        if (type == "court_visit" && letterRows.Count == 0)
            return (null, "مهمة زيارة المحكمة تتطلب صفوف خطاب التفويض");

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            var (displayId, reference) = await NextIdsAsync(now, type == "court_visit", cancellationToken);

            var entity = new OperationsTask
            {
                Id = Guid.NewGuid(),
                DisplayId = displayId,
                Type = type,
                Title = title,
                Description = request.Description?.Trim(),
                Scope = scope,
                DeedsJson = deeds.Count > 0 ? JsonSerializer.Serialize(deeds, JsonOpts) : null,
                PoNumber = poNumber,
                AssigneeId = assigneeId,
                AssigneeName = request.AssigneeName?.Trim() ?? "",
                CreatedBy = createdBy.Trim(),
                CreatedByName = createdByName?.Trim() ?? "",
                Status = "created",
                Priority = priority,
                DueAtUtc = dueAt,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                Reference = reference,
                LetterRowsJson = letterRows.Count > 0
                    ? JsonSerializer.Serialize(letterRows, JsonOpts)
                    : null,
                CommentsJson = JsonSerializer.Serialize(
                    new[]
                    {
                        new OperationsTaskCommentDto
                        {
                            Who = "system",
                            At = now.ToString("O"),
                            Text = "تم إنشاء المهمة",
                            Kind = "update",
                        },
                    },
                    JsonOpts),
            };

            _db.OperationsTasks.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            await NotifyAssigneeAsync(entity, cancellationToken);
            return ((OperationsTaskDto?)Map(entity), (string?)null);
        });
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> PatchAsync(
        Guid id,
        PatchOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.OperationsTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        var now = DateTime.UtcNow;
        var comments = DeserializeComments(entity.CommentsJson).ToList();
        var changed = false;
        var becameCompleted = false;
        var becameCompletedCourtVisit = false;
        string? oldPriority = null;
        DateTime? oldDue = null;

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var next = request.Status.Trim();
            if (!ValidStatuses.Contains(next))
                return (null, "الحالة غير مدعومة");

            if (next == "in_progress" && entity.Status == "paused")
                next = entity.PrevStatus ?? "in_progress";

            var error = ValidateStatusTransition(entity, next, actorAssigneeId, actorRole);
            if (error is not null) return (null, error);

            if (next == "paused")
                entity.PrevStatus = entity.Status;

            if (entity.Status != next)
            {
                comments.Add(new OperationsTaskCommentDto
                {
                    Who = "system",
                    At = now.ToString("O"),
                    Text = StatusUpdateText(entity.Status, next, actorName),
                    Kind = "update",
                });
                entity.Status = next;
                changed = true;
                if (next == "completed")
                {
                    becameCompleted = true;
                    if (entity.Type == "court_visit")
                        becameCompletedCourtVisit = true;
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            var priority = request.Priority.Trim();
            if (!ValidPriorities.Contains(priority))
                return (null, "الأولوية غير مدعومة");
            if (entity.Priority != priority)
            {
                oldPriority = entity.Priority;
                entity.Priority = priority;
                changed = true;
            }
        }

        if (request.DueAtUtc.HasValue && entity.DueAtUtc != request.DueAtUtc.Value)
        {
            oldDue = entity.DueAtUtc;
            entity.DueAtUtc = request.DueAtUtc.Value;
            changed = true;
        }

        if (oldPriority is not null || oldDue is not null)
        {
            var parts = new List<string>();
            if (oldPriority is not null)
                parts.Add($"الأولوية إلى «{PriorityLabel(entity.Priority)}»");
            if (oldDue is not null)
                parts.Add($"موعد الاستحقاق إلى {FormatDueLabel(entity.DueAtUtc)}");
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = now.ToString("O"),
                Text = "⚑ تحديث: " + string.Join(" و ", parts) + ".",
                Kind = "update",
            });
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            var title = request.Title.Trim();
            if (title.Length > 0 && entity.Title != title)
            {
                entity.Title = title;
                changed = true;
            }
        }

        if (request.Description is not null)
        {
            entity.Description = request.Description.Trim();
            changed = true;
        }

        if (!changed) return (Map(entity), null);

        entity.UpdatedAtUtc = now;
        entity.CommentsJson = JsonSerializer.Serialize(comments, JsonOpts);
        await _db.SaveChangesAsync(cancellationToken);

        if (becameCompleted)
            await NotifyCreatorOnCompletedAsync(entity, actorUserId, actorName, cancellationToken);

        if (becameCompletedCourtVisit)
            await NotifyCourtVisitCompletedAsync(entity, cancellationToken);

        return (Map(entity), null);
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!IsManager(actorRole))
            return (null, "هذا الإجراء للمنشئ أو المشرف فقط");

        var entity = await _db.OperationsTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        if (TerminalStatuses.Contains(entity.Status))
            return (null, "المهمة في حالة نهائية");

        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length == 0)
            return (null, "سبب إعادة التوجيه مطلوب");

        var newAssigneeId = request.AssigneeId?.Trim() ?? "";
        if (newAssigneeId.Length == 0)
            return (null, "المنفّذ مطلوب");

        var now = DateTime.UtcNow;
        var oldName = string.IsNullOrWhiteSpace(entity.AssigneeName) ? entity.AssigneeId : entity.AssigneeName.Trim();
        var newName = string.IsNullOrWhiteSpace(request.AssigneeName)
            ? newAssigneeId
            : request.AssigneeName.Trim();

        var dueChanged = request.DueAtUtc.HasValue && entity.DueAtUtc != request.DueAtUtc.Value;
        var text = dueChanged
            ? $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — موعد التسليم {FormatDueLabel(request.DueAtUtc!.Value)} — السبب: {reason}"
            : $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — السبب: {reason}";

        entity.AssigneeId = newAssigneeId;
        entity.AssigneeName = request.AssigneeName?.Trim() ?? "";
        if (request.DueAtUtc.HasValue)
            entity.DueAtUtc = request.DueAtUtc.Value;

        var comments = DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = "system",
            At = now.ToString("O"),
            Text = text,
            Kind = "update",
        });

        entity.CommentsJson = JsonSerializer.Serialize(comments, JsonOpts);
        entity.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(cancellationToken);

        await NotifyAssigneeAsync(entity, cancellationToken);
        return (Map(entity), null);
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!IsManager(actorRole))
            return (null, "التذكير للمنشئ أو المشرف فقط");

        var entity = await _db.OperationsTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        return await ApplyReminderAsync(entity, auto, cancellationToken);
    }

    public async Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default)
    {
        var active = await _db.OperationsTasks
            .Where(t => t.Status == "created" || t.Status == "in_progress")
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var successes = 0;

        foreach (var entity in active)
        {
            var from = ResolveLastReminderAnchorUtc(entity);
            var next = OperationsTaskReminderCalculator.NextReminderUtc(entity.Priority, from);
            if (now < next) continue;

            var (result, error) = await ApplyReminderAsync(entity, auto: true, cancellationToken);
            if (result is not null && error is null)
                successes++;
        }

        return successes;
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.OperationsTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        var files = (request.Files ?? [])
            .Where(f => !string.IsNullOrWhiteSpace(f.Name))
            .Select(f => new OperationsTaskCommentFileDto
            {
                Name = f.Name.Trim(),
                Size = string.IsNullOrWhiteSpace(f.Size) ? "—" : f.Size.Trim(),
            })
            .Take(20)
            .ToList();

        var text = request.Text?.Trim() ?? "";
        if (text.Length == 0 && files.Count == 0)
            return (null, "أضف تعليقاً أو مرفقاً");

        var who = actorRole is "case-specialist" or "section-supervisor" or "cdo" or "general-manager"
            ? "creator"
            : entity.AssigneeId == actorAssigneeId.Trim()
                ? "assignee"
                : "creator";

        var comments = DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = who,
            At = DateTime.UtcNow.ToString("O"),
            Text = text.Length == 0
                ? ""
                : actorName is { Length: > 0 } ? $"{actorName}: {text}" : text,
            Kind = request.Kind?.Trim() ?? "comment",
            Files = files,
        });

        entity.CommentsJson = JsonSerializer.Serialize(comments, JsonOpts);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return (Map(entity), null);
    }

    private async Task<(OperationsTaskDto? Result, string? Error)> ApplyReminderAsync(
        OperationsTask entity,
        bool auto,
        CancellationToken cancellationToken)
    {
        if (entity.Status is not ("created" or "in_progress"))
            return (null, "التذكير متاح للمهام المنشأة أو قيد التنفيذ فقط");

        var now = DateTime.UtcNow;
        var reminders = DeserializeReminders(entity.RemindersJson).ToList();
        reminders.Add(new OperationsTaskReminderDto
        {
            At = now.ToString("O"),
            Auto = auto,
        });

        var comments = DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = "system",
            At = now.ToString("O"),
            Text = auto
                ? "⏰ تذكير تلقائي ضمن ساعات العمل."
                : "🔔 تم إرسال تذكير فوري إلى المنفّذ.",
            Kind = "reminder",
        });

        entity.RemindersJson = JsonSerializer.Serialize(reminders, JsonOpts);
        entity.CommentsJson = JsonSerializer.Serialize(comments, JsonOpts);
        entity.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(cancellationToken);

        await NotifyReminderAsync(entity, cancellationToken);
        return (Map(entity), null);
    }

    private static bool IsManager(string actorRole)
    {
        var role = actorRole.Trim();
        return role is "case-specialist" or "section-supervisor" or "general-manager"
            || string.Equals(role, "cdo", StringComparison.OrdinalIgnoreCase);
    }

    private async Task NotifyAssigneeAsync(OperationsTask entity, CancellationToken cancellationToken)
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

    private async Task NotifyCreatorOnCompletedAsync(
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

    private async Task NotifyReminderAsync(OperationsTask entity, CancellationToken cancellationToken)
    {
        var userId = await ResolveUserIdForAssigneeAsync(entity.AssigneeId, cancellationToken);
        if (userId is null) return;

        var unix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "تذكير بمهمة",
                Body = $"تذكير بالمهمة {entity.DisplayId}: {entity.Title}.",
                Tone = "warning",
                Href = OperationsTaskHref(entity.Id),
                Category = "workflow",
                EntityType = "operations-task",
                EntityId = entity.Id.ToString(),
                SourceEvent = $"ops-task-remind:{entity.Id}:{unix}",
            },
            cancellationToken);
    }

    private async Task NotifyCourtVisitCompletedAsync(
        OperationsTask entity,
        CancellationToken cancellationToken)
    {
        var pos = new HashSet<string>(StringComparer.Ordinal);
        var primary = entity.PoNumber?.Trim();
        if (!string.IsNullOrEmpty(primary)) pos.Add(primary);
        foreach (var row in DeserializeLetterRows(entity.LetterRowsJson))
        {
            var p = row.Po?.Trim();
            if (!string.IsNullOrEmpty(p)) pos.Add(p);
        }
        if (pos.Count == 0) return;

        var assigneeIds = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PoNumber != null && pos.Contains(t.PoNumber))
            .Where(t => t.Kind == "government-review")
            .Where(t => t.Status != WorkflowTaskStatus.Completed
                        && t.Status != WorkflowTaskStatus.Cancelled)
            .Where(t => t.AssigneeId != null && t.AssigneeId != "")
            .Select(t => t.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var poLabel = string.Join("، ", pos);
        foreach (var assigneeId in assigneeIds)
        {
            var userId = await ResolveUserIdForAssigneeAsync(assigneeId, cancellationToken);
            if (userId is null) continue;

            await _notifications.CreateForUserAsync(
                userId,
                new CreateUserNotificationRequest
                {
                    Title = "زيارة محكمة مكتملة",
                    Body =
                        $"اكتملت زيارة المحكمة ({entity.DisplayId}) لأمر العمل {poLabel}.",
                    Tone = "success",
                    Href = "/government-review",
                    Category = "workflow",
                    EntityType = "operations-task",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"ops-task-court-done:{entity.Id}:{userId}",
                },
                cancellationToken);
        }
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

    private static string FormatDueLabel(DateTime dueAtUtc) =>
        dueAtUtc.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) + " UTC";

    private static string PriorityLabel(string priority) => priority switch
    {
        "high" => "عالية",
        "low" => "منخفضة",
        _ => "متوسطة",
    };

    private static DateTime ResolveLastReminderAnchorUtc(OperationsTask entity)
    {
        var reminders = DeserializeReminders(entity.RemindersJson);
        if (reminders.Count == 0) return entity.CreatedAtUtc;

        var lastAt = reminders[^1].At;
        if (!DateTime.TryParse(
                lastAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsed))
            return entity.CreatedAtUtc;

        return parsed.Kind switch
        {
            DateTimeKind.Utc => parsed,
            DateTimeKind.Local => parsed.ToUniversalTime(),
            _ => DateTime.SpecifyKind(parsed, DateTimeKind.Utc),
        };
    }

    private static string? ValidateScope(string scope, IReadOnlyList<string> deeds, string? poNumber)
    {
        return scope switch
        {
            "transaction" when deeds.Count != 1 =>
                "نطاق المعاملة يتطلب صكاً واحداً",
            "work_order" when string.IsNullOrWhiteSpace(poNumber) =>
                "نطاق أمر العمل يتطلب رقم PO",
            "multi" when deeds.Count < 2 =>
                "نطاق عدة معاملات يتطلب صكّين فأكثر",
            _ => null,
        };
    }

    private static string? ValidateStatusTransition(
        OperationsTask entity,
        string next,
        string actorAssigneeId,
        string actorRole)
    {
        if (TerminalStatuses.Contains(entity.Status))
            return "المهمة في حالة نهائية";

        var actor = actorAssigneeId.Trim();
        var isManager = IsManager(actorRole);

        if (next is "in_progress" or "completed")
        {
            if (entity.AssigneeId != actor && !isManager)
                return "هذا الإجراء للمنفّذ المكلّف فقط";
        }

        if ((next is "paused" or "cancelled") && !isManager)
            return "هذا الإجراء للمنشئ أو المشرف فقط";

        return next switch
        {
            "in_progress" when entity.Status is "created" or "paused" => null,
            "completed" when entity.Status is "in_progress" => null,
            "paused" when entity.Status is "created" or "in_progress" => null,
            "cancelled" => null,
            _ => "انتقال حالة غير مسموح",
        };
    }

    private static DateTime DefaultDueAt(string priority, DateTime now)
    {
        return priority switch
        {
            "high" => now.AddHours(4),
            "low" => now.AddDays(1),
            _ => now.AddHours(12),
        };
    }

    private async Task<(string DisplayId, string? Reference)> NextIdsAsync(
        DateTime now,
        bool courtVisit,
        CancellationToken cancellationToken)
    {
        var year = now.Year;
        var seqRow = await _db.OperationsTaskSequences
            .FirstOrDefaultAsync(s => s.Year == year, cancellationToken);

        if (seqRow is null)
        {
            seqRow = new OperationsTaskSequence
            {
                Id = Guid.NewGuid(),
                Year = year,
                NextSeq = 1,
                UpdatedAtUtc = now,
            };
            _db.OperationsTaskSequences.Add(seqRow);
        }

        var seq = seqRow.NextSeq;
        seqRow.NextSeq += 1;
        seqRow.UpdatedAtUtc = now;
        var displayId = $"T-{year}-{seq:D4}";
        var reference = courtVisit ? $"خ.ت-{year}-{seq:D4}" : null;
        return (displayId, reference);
    }

    private static string StatusUpdateText(string from, string to, string? actorName)
    {
        var actor = string.IsNullOrWhiteSpace(actorName) ? "النظام" : actorName.Trim();
        return to switch
        {
            "in_progress" => $"{actor} بدأ التنفيذ",
            "completed" => $"{actor} أكمل المهمة",
            "paused" => $"{actor} أوقف المهمة مؤقتاً",
            "cancelled" => $"{actor} ألغى المهمة",
            _ when from == "paused" => $"{actor} استأنف المهمة",
            _ => $"{actor} غيّر الحالة إلى {to}",
        };
    }

    private static OperationsTaskDto Map(OperationsTask row) => new()
    {
        Id = row.Id.ToString(),
        DisplayId = row.DisplayId,
        Type = row.Type,
        Title = row.Title,
        Description = row.Description,
        Scope = row.Scope,
        Deeds = DeserializeStrings(row.DeedsJson),
        PoNumber = row.PoNumber,
        AssigneeId = row.AssigneeId,
        AssigneeName = row.AssigneeName,
        CreatedBy = row.CreatedBy,
        CreatedByName = row.CreatedByName,
        Status = row.Status,
        PrevStatus = row.PrevStatus,
        Priority = row.Priority,
        DueAt = row.DueAtUtc.ToString("O"),
        CreatedAt = row.CreatedAtUtc.ToString("O"),
        UpdatedAt = row.UpdatedAtUtc.ToString("O"),
        Reference = row.Reference,
        LetterRows = DeserializeLetterRows(row.LetterRowsJson),
        Comments = DeserializeComments(row.CommentsJson),
        Reminders = DeserializeReminders(row.RemindersJson),
    };

    private static IReadOnlyList<string> DeserializeStrings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static IReadOnlyList<OperationsTaskLetterRowDto> DeserializeLetterRows(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskLetterRowDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static IReadOnlyList<OperationsTaskCommentDto> DeserializeComments(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskCommentDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static IReadOnlyList<OperationsTaskReminderDto> DeserializeReminders(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OperationsTaskReminderDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
