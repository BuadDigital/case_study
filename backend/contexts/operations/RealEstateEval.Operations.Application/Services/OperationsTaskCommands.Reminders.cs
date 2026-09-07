using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class OperationsTaskCommands
{
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
            comments.Add(OperationsTaskCommandRules.SystemComment(
                OperationsTaskCommandRules.PauseOverLimitReminderText,
                now,
                kind: "reminder"));
            entity.ReplaceComments(
                JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts), now);
            entity.MarkPauseOverLimitReminded(now);
            await _repo.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyPauseOverLimitAsync(entity, cancellationToken);
            successes++;
        }

        return successes;
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
        comments.Add(OperationsTaskCommandRules.SystemComment(
            OperationsTaskCommandRules.ReminderCommentText(auto),
            now,
            kind: "reminder"));

        entity.ReplaceReminders(
            JsonSerializer.Serialize(reminders, OperationsTaskSerialization.JsonOpts), now);
        entity.ReplaceComments(
            JsonSerializer.Serialize(comments, OperationsTaskSerialization.JsonOpts), now);
        await _repo.SaveChangesAsync(cancellationToken);

        await _notifier.NotifyReminderAsync(entity, auto, cancellationToken);
        return (await _query.MapAsync(entity, cancellationToken), null);
    }
}
