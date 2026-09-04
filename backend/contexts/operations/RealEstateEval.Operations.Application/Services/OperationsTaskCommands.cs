using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

/// <summary>
/// Operations-task write use cases: create, patch, reassign, remind, comment. Persistence goes
/// through <see cref="IOperationsTaskRepository"/> and court-visit pricing through
/// <see cref="IOperationsTaskVisitFees"/>, so this file holds workflow only — no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed class OperationsTaskCommands : IOperationsTaskCommands
{
    private readonly IOperationsTaskRepository _repo;
    private readonly IOperationsTaskQuery _query;
    private readonly OperationsTaskNotifier _notifier;
    private readonly IOperationsTaskVisitFees _visitFees;
    private readonly TimeProvider _time;

    public OperationsTaskCommands(
        IOperationsTaskRepository repo,
        IOperationsTaskQuery query,
        OperationsTaskNotifier notifier,
        IOperationsTaskVisitFees visitFees,
        TimeProvider? time = null)
    {
        _repo = repo;
        _query = query;
        _notifier = notifier;
        _visitFees = visitFees;
        _time = time ?? TimeProvider.System;
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> CreateAsync(
        CreateOperationsTaskRequest request,
        string createdBy,
        string? createdByName,
        CancellationToken cancellationToken = default)
    {
        if (!OperationsTaskTypeValues.TryParse(request.Type, out var type))
            return (null, "نوع المهمة غير مدعوم");

        if (!OperationsTaskScopeValues.TryParse(request.Scope, out var scope))
            return (null, "نطاق الربط غير مدعوم");

        var assigneeId = request.AssigneeId.Trim();
        if (assigneeId.Length == 0)
            return (null, "المنفّذ مطلوب");

        var title = request.Title.Trim();
        if (title.Length == 0)
            return (null, "العنوان مطلوب");

        var priority = OperationsTaskPriority.Medium;
        if (!string.IsNullOrWhiteSpace(request.Priority)
            && !OperationsTaskPriorityValues.TryParse(request.Priority, out priority))
        {
            return (null, "الأولوية غير مدعومة");
        }

        var deeds = (request.Deeds ?? [])
            .Select(d => d.Trim())
            .Where(d => d.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var poNumber = request.PoNumber?.Trim();
        var validationError = OperationsTaskLifecycleRules.ValidateScope(scope, deeds, poNumber);
        if (validationError is not null)
            return (null, validationError);

        var now = _time.GetUtcNow().UtcDateTime;
        var dueAt = request.DueAtUtc ?? OperationsTaskLifecycleRules.DefaultDueAt(priority, now);

        var letterRows = request.LetterRows?.ToList() ?? [];
        var isCourtVisit = type == OperationsTaskType.CourtVisit;
        if (isCourtVisit && letterRows.Count == 0)
            return (null, "مهمة زيارة المحكمة تتطلب صفوف خطاب التفويض");

        decimal? agreedVisitFee = null;
        Guid? visitFeePricingTableId = null;
        if (isCourtVisit)
        {
            var (visitFee, visitTableId, visitError) =
                await _visitFees.ResolveCreateVisitFeeAsync(
                    assigneeId, request.VisitFeeAmountSar, cancellationToken);
            if (visitError is not null)
                return (null, visitError);
            agreedVisitFee = visitFee;
            visitFeePricingTableId = visitTableId;
        }
        else if (request.VisitFeeAmountSar is not null)
        {
            return (null, "مبلغ أتعاب الزيارة يخص مهام زيارة المحكمة فقط.");
        }

        var resolvedCreatorName = await _notifier.ResolveActorDisplayNameAsync(
            createdBy,
            createdByName,
            cancellationToken);

        var jsonOpts = OperationsTaskSerialization.JsonOpts;
        var entity = await _repo.ExecuteInTransactionAsync(async ct =>
        {
            var (displayId, reference) = await NextIdsAsync(now, isCourtVisit, ct);

            var created = OperationsTask.Create(
                Guid.NewGuid(),
                displayId,
                type,
                title,
                scope,
                assigneeId,
                createdBy.Trim(),
                priority,
                dueAt,
                now,
                description: request.Description?.Trim(),
                deedsJson: deeds.Count > 0 ? JsonSerializer.Serialize(deeds, jsonOpts) : null,
                poNumber: poNumber,
                assigneeName: request.AssigneeName?.Trim(),
                createdByName: resolvedCreatorName,
                reference: reference,
                letterRowsJson: letterRows.Count > 0
                    ? JsonSerializer.Serialize(letterRows, jsonOpts)
                    : null,
                commentsJson: JsonSerializer.Serialize(
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
                    jsonOpts),
                agreedVisitFeeSar: agreedVisitFee,
                visitFeePricingTableId: visitFeePricingTableId);

            await _repo.AddAsync(created, ct);
            await _repo.SaveChangesAsync(ct);
            return (Commit: true, Result: created);
        },
        cancellationToken);

        await _notifier.NotifyAssigneeAsync(entity, cancellationToken);
        return (await _query.MapAsync(entity, cancellationToken), null);
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
        var entity = await _repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        var isManager = OperationsTaskLifecycleRules.IsManager(actorRole);
        var actor = actorAssigneeId.Trim();
        var isAssignee = actor.Length > 0
            && string.Equals(entity.AssigneeId, actor, StringComparison.OrdinalIgnoreCase);
 // Fallback: display name match when DistAssigneeId drifts (staff seed / create UI).
        if (!isAssignee && !isManager && !string.IsNullOrWhiteSpace(actorName))
        {
            isAssignee = string.Equals(
                (entity.AssigneeName ?? "").Trim(),
                actorName.Trim(),
                StringComparison.Ordinal);
        }

        if (!isManager && !isAssignee)
            return (null, "هذا الإجراء للمنفّذ المكلّف أو المشرف فقط");

 // Non-managers may only transition status / execution fields — not re-author the task.
        if (!isManager
            && (request.Title is not null
                || request.Description is not null
                || request.Priority is not null
                || request.DueAtUtc.HasValue))
        {
            return (null, "تعديل تفاصيل المهمة للمشرف فقط");
        }

        var now = _time.GetUtcNow().UtcDateTime;
        var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
        var changed = false;
        var becameCompleted = false;
        var becameCompletedCourtVisit = false;
        var becameReceiptConfirmed = false;
        var becameCancelled = false;
        var courtVisitFee = ResolvedPartyFee.Unresolved;
        OperationsTaskPriority? oldPriority = null;
        DateTime? oldDue = null;
        var jsonOpts = OperationsTaskSerialization.JsonOpts;

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (!OperationsTaskStatusValues.TryParse(request.Status, out var next))
                return (null, "الحالة غير مدعومة");

            var error = OperationsTaskLifecycleRules.ValidateStatusTransition(
                entity, next, actorAssigneeId, actorRole, actorName, request.PauseReason);
            if (error is not null) return (null, error);

            var pauseReason = request.PauseReason?.Trim();
            if (next == OperationsTaskStatus.Paused && string.IsNullOrEmpty(pauseReason))
                return (null, "سبب الإيقاف المؤقت مطلوب");

            var cancelReason = request.CancelReason?.Trim();
            if (next == OperationsTaskStatus.Cancelled && string.IsNullOrEmpty(cancelReason))
                return (null, "سبب الإلغاء مطلوب");

            if (next == OperationsTaskStatus.Completed && entity.IsCourtVisit)
            {
                var (normalized, courtError) = OperationsTaskCourtVisitRules.Normalize(request.CourtVisitResult);
                if (courtError is not null) return (null, courtError);

 // Price the visit before touching the task. Refusing further down would leave a
 // completed entity sitting in the change tracker even though nothing was saved.
                (courtVisitFee, var pricingError) =
                    await _visitFees.ResolveCourtVisitFeeAsync(entity, cancellationToken);
                if (pricingError is not null) return (null, pricingError);

                OperationsTaskCourtVisitRules.AppendResultComments(comments, normalized!, now);
                entity.RecordCourtVisitResult(JsonSerializer.Serialize(normalized, jsonOpts), now);
                changed = true;
            }

            if (next == OperationsTaskStatus.Completed)
                OperationsTaskLifecycleRules.ApplyExecutionCredit(entity, request, comments, now, actorName);

            if (entity.Status != next)
            {
                var fromStatus = entity.TransitionTo(next, now, pauseReason, cancelReason);
                comments.Add(new OperationsTaskCommentDto
                {
                    Who = "system",
                    At = now.ToString("O"),
                    Text = OperationsTaskLifecycleRules.StatusUpdateText(
                        fromStatus,
                        next,
                        actorName,
                        entity.PauseReason,
                        entity.CancelReason),
                    Kind = "update",
                });
                changed = true;
                if (fromStatus == OperationsTaskStatus.Created
                    && next == OperationsTaskStatus.InProgress)
                {
                    becameReceiptConfirmed = true;
                }
                if (next == OperationsTaskStatus.Completed)
                {
                    becameCompleted = true;
                    if (entity.IsCourtVisit)
                        becameCompletedCourtVisit = true;
                }
                if (next == OperationsTaskStatus.Cancelled)
                    becameCancelled = true;
            }
        }
        else if (request.CourtVisitResult is not null && entity.IsCourtVisit)
        {
            var (normalized, courtError) = OperationsTaskCourtVisitRules.Normalize(request.CourtVisitResult);
            if (courtError is not null) return (null, courtError);
            OperationsTaskCourtVisitRules.AppendResultComments(comments, normalized!, now);
            entity.RecordCourtVisitResult(JsonSerializer.Serialize(normalized, jsonOpts), now);
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            if (!OperationsTaskPriorityValues.TryParse(request.Priority, out var priority))
                return (null, "الأولوية غير مدعومة");
            if (entity.Priority != priority)
            {
                oldPriority = entity.Priority;
                entity.ChangePriority(priority, now);
                changed = true;
            }
        }

        if (request.DueAtUtc.HasValue && entity.DueAtUtc != request.DueAtUtc.Value)
        {
            oldDue = entity.DueAtUtc;
            entity.Reschedule(request.DueAtUtc.Value, now);
            changed = true;
        }

        if (oldPriority is not null || oldDue is not null)
        {
            var parts = new List<string>();
            if (oldPriority is not null)
                parts.Add($"الأولوية إلى «{entity.Priority.ToArabicLabel()}»");
            if (oldDue is not null)
                parts.Add($"موعد الاستحقاق إلى {OperationsTaskSerialization.FormatDueLabel(entity.DueAtUtc)}");
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
                entity.Retitle(title, now);
                changed = true;
            }
        }

        if (request.Description is not null)
        {
            entity.Describe(request.Description.Trim(), now);
            changed = true;
        }

        if (!changed) return (await _query.MapAsync(entity, cancellationToken), null);

        entity.ReplaceComments(JsonSerializer.Serialize(comments, jsonOpts), now);

        await _repo.SaveChangesAsync(cancellationToken);
        if (becameCompletedCourtVisit && courtVisitFee.IsResolved)
            await _visitFees.AddCourtVisitFeeChargeAsync(entity, courtVisitFee, cancellationToken);

        if (becameReceiptConfirmed)
        {
            await _notifier.NotifyStakeholdersOnReceiptAsync(
                entity, actorName, actorUserId, cancellationToken);
        }

        if (becameCancelled)
        {
            await _notifier.NotifyAssigneeOnCancelledAsync(
                entity, actorName, actorUserId, cancellationToken);
        }

        if (oldPriority is not null || oldDue is not null)
        {
            await _notifier.NotifyAssigneeOnScheduleChangedAsync(
                entity,
                priorityChanged: oldPriority is not null,
                dueChanged: oldDue is not null,
                actorName,
                actorUserId,
                cancellationToken);
        }

        if (becameCompleted)
            await _notifier.NotifyCreatorOnCompletedAsync(entity, actorUserId, actorName, cancellationToken);

        if (becameCompletedCourtVisit)
            await _notifier.NotifyCourtVisitCompletedAsync(entity, cancellationToken);

        return (await _query.MapAsync(entity, cancellationToken), null);
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!OperationsTaskLifecycleRules.IsManager(actorRole))
            return (null, "هذا الإجراء للمنشئ أو المشرف فقط");

        var entity = await _repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        if (entity.IsTerminal)
            return (null, "المهمة في حالة نهائية");

        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length == 0)
            return (null, "سبب إعادة التوجيه مطلوب");

        var newAssigneeId = request.AssigneeId?.Trim() ?? "";
        if (newAssigneeId.Length == 0)
            return (null, "المنفّذ مطلوب");

        var now = _time.GetUtcNow().UtcDateTime;
        var oldName = string.IsNullOrWhiteSpace(entity.AssigneeName) ? entity.AssigneeId : entity.AssigneeName.Trim();
        var newName = string.IsNullOrWhiteSpace(request.AssigneeName)
            ? newAssigneeId
            : request.AssigneeName.Trim();

        var dueChanged = request.DueAtUtc.HasValue && entity.DueAtUtc != request.DueAtUtc.Value;
        var text = dueChanged
            ? $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — موعد التسليم {OperationsTaskSerialization.FormatDueLabel(request.DueAtUtc!.Value)} — السبب: {reason}"
            : $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — السبب: {reason}";

        entity.Reassign(
            newAssigneeId,
            request.AssigneeName?.Trim() ?? "",
            request.DueAtUtc,
            now);

        var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = "system",
            At = now.ToString("O"),
            Text = text,
            Kind = "update",
        });

        entity.ReplaceComments(JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts), now);
        await _repo.SaveChangesAsync(cancellationToken);

        await _notifier.NotifyAssigneeAsync(entity, cancellationToken);
        return (await _query.MapAsync(entity, cancellationToken), null);
    }

    public async Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (!OperationsTaskLifecycleRules.IsManager(actorRole))
            return (null, "التذكير للمنشئ أو المشرف فقط");

        var entity = await _repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        return await ApplyReminderAsync(entity, auto, cancellationToken);
    }

    public async Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default)
    {
        var active = await _repo.ListActiveAsync(cancellationToken);

        var now = _time.GetUtcNow().UtcDateTime;
        var successes = 0;

        foreach (var entity in active)
        {
            var from = OperationsTaskSerialization.ResolveLastReminderAnchorUtc(entity);
            var next = OperationsTaskReminderCalculator.NextReminderUtc(entity.Priority, from);
            if (now < next) continue;

            var (result, error) = await ApplyReminderAsync(entity, auto: true, cancellationToken);
            if (result is not null && error is null)
                successes++;
        }

        return successes;
    }

    public async Task<int> ProcessOverLimitPauseRemindersAsync(CancellationToken cancellationToken = default)
    {
        var paused = await _repo.ListPausedAsync(cancellationToken);

        var now = _time.GetUtcNow().UtcDateTime;
        var successes = 0;

        foreach (var entity in paused)
        {
            var pausedAt = entity.PausedAtUtc!.Value;
            var deadline = OperationsTaskReminderCalculator.PauseLimitDeadlineUtc(pausedAt);
            if (now < deadline) continue;

            if (entity.PauseOverLimitRemindedAtUtc is DateTime last
                && now < last.AddHours(20))
                continue;

            var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = now.ToString("O"),
                Text = "⏸ تذكير: تجاوزت المهمة حد الإيقاف المؤقت (يوم عمل واحد) — يلزم الاستئناف.",
                Kind = "reminder",
            });
            entity.ReplaceComments(
                JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts), now);
            entity.MarkPauseOverLimitReminded(now);
            await _repo.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyPauseOverLimitAsync(entity, cancellationToken);
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
        var entity = await _repo.FindAsync(id, cancellationToken);
        if (entity is null) return (null, "المهمة غير موجودة");

        var files = (request.Files ?? [])
            .Where(f => !string.IsNullOrWhiteSpace(f.Name))
            .Select(f => new OperationsTaskCommentFileDto
            {
                Name = f.Name.Trim(),
                Size = string.IsNullOrWhiteSpace(f.Size) ? "—" : f.Size.Trim(),
                AttachmentId = string.IsNullOrWhiteSpace(f.AttachmentId) ? null : f.AttachmentId.Trim(),
                ContentType = string.IsNullOrWhiteSpace(f.ContentType) ? null : f.ContentType.Trim(),
            })
            .Take(20)
            .ToList();

        if (!OperationsTaskLifecycleRules.IsManager(actorRole)
            && entity.AssigneeId != actorAssigneeId.Trim())
        {
            return (null, "التعليق متاح للمنفّذ المكلّف أو المشرف فقط");
        }

        var text = request.Text?.Trim() ?? "";
        if (text.Length == 0 && files.Count == 0)
            return (null, "أضف تعليقاً أو مرفقاً");

        var who = actorRole is "case-specialist" or "section-supervisor" or "cdo" or "general-manager"
            ? "creator"
            : entity.AssigneeId == actorAssigneeId.Trim()
                ? "assignee"
                : "creator";

        var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = who,
            At = _time.GetUtcNow().UtcDateTime.ToString("O"),
            Text = text.Length == 0
                ? ""
                : actorName is { Length: > 0 } ? $"{actorName}: {text}" : text,
            Kind = request.Kind?.Trim() ?? "comment",
            Files = files,
        });

        entity.ReplaceComments(
            JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts),
            _time.GetUtcNow().UtcDateTime);
        await _repo.SaveChangesAsync(cancellationToken);

        var kind = request.Kind?.Trim() ?? "comment";
 // Human thread only — system updates / reminders are not counterparty chatter.
        if (kind is "comment" or "close" or "")
        {
            await _notifier.NotifyCounterpartyOnCommentAsync(
                entity,
                who,
                actorName,
                text,
                cancellationToken);
        }

        return (await _query.MapAsync(entity, cancellationToken), null);
    }

    private async Task<(OperationsTaskDto? Result, string? Error)> ApplyReminderAsync(
        OperationsTask entity,
        bool auto,
        CancellationToken cancellationToken)
    {
        if (!entity.Status.IsActive())
            return (null, "التذكير متاح للمهام المنشأة أو قيد التنفيذ فقط");

        var now = _time.GetUtcNow().UtcDateTime;
        var reminders = OperationsTaskSerialization.DeserializeReminders(entity.RemindersJson).ToList();
        reminders.Add(new OperationsTaskReminderDto
        {
            At = now.ToString("O"),
            Auto = auto,
        });

        var comments = OperationsTaskSerialization.DeserializeComments(entity.CommentsJson).ToList();
        comments.Add(new OperationsTaskCommentDto
        {
            Who = "system",
            At = now.ToString("O"),
            Text = auto
                ? "⏰ تذكير تلقائي ضمن ساعات العمل (المنفّذ والمنشئ)."
                : "🔔 تم إرسال تذكير فوري إلى المنفّذ.",
            Kind = "reminder",
        });

        entity.ReplaceReminders(
            JsonSerializer.Serialize(reminders, OperationsTaskSerialization.JsonOpts), now);
        entity.ReplaceComments(
            JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts), now);
        await _repo.SaveChangesAsync(cancellationToken);

        await _notifier.NotifyReminderAsync(entity, auto, cancellationToken);
        return (await _query.MapAsync(entity, cancellationToken), null);
    }

    private async Task<(string DisplayId, string? Reference)> NextIdsAsync(
        DateTime now,
        bool courtVisit,
        CancellationToken cancellationToken)
    {
        var year = now.Year;
        var seq = await _repo.AllocateNextTaskSequenceAsync(year, now, cancellationToken);
        var displayId = $"T-{year}-{seq:D4}";
        var reference = courtVisit ? $"خ.ت-{year}-{seq:D4}" : null;
        return (displayId, reference);
    }
}
