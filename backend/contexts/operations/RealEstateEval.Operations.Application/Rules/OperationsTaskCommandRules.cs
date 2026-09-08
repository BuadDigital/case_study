using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>
/// Pure helpers behind the operations-task write use cases: system-comment construction,
/// deed / attachment normalization, comment authorship, reassignment and schedule-change
/// wording, and display-id / reference numbering. No ports, no clock.
/// </summary>
public static class OperationsTaskCommandRules
{
    public const string CreatedCommentText = "تم إنشاء المهمة";

    public const string PauseOverLimitReminderText =
        "⏸ تذكير: تجاوزت المهمة حد الإيقاف المؤقت (يوم عمل واحد) — يلزم الاستئناف.";

    public static OperationsTaskCommentDto SystemComment(
        string text,
        DateTime now,
        string kind = "update") => new()
        {
            Who = "system",
            At = now.ToString("O"),
            Text = text,
            Kind = kind,
        };

    public static List<string> NormalizeDeeds(IReadOnlyList<string>? deeds) =>
        (deeds ?? [])
            .Select(d => d.Trim())
            .Where(d => d.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// <summary>"⚑ تحديث: …" line for a priority and/or due-date change (at least one must be set).</summary>
    public static string ScheduleChangeText(
        OperationsTaskPriority priority,
        DateTime dueAtUtc,
        bool priorityChanged,
        bool dueChanged)
    {
        var parts = new List<string>();
        if (priorityChanged)
            parts.Add($"الأولوية إلى «{priority.ToArabicLabel()}»");
        if (dueChanged)
            parts.Add($"موعد الاستحقاق إلى {OperationsTaskSerialization.FormatDueLabel(dueAtUtc)}");
        return "⚑ تحديث: " + string.Join(" و ", parts) + ".";
    }

    public static string AssigneeLabel(string assigneeId, string? assigneeName) =>
        string.IsNullOrWhiteSpace(assigneeName) ? assigneeId : assigneeName.Trim();

    /// <summary><paramref name="newDueAtUtc"/> is passed only when the due date actually changes.</summary>
    public static string ReassignText(
        string oldName,
        string newName,
        string reason,
        DateTime? newDueAtUtc) =>
        newDueAtUtc is { } due
            ? $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — موعد التسليم {OperationsTaskSerialization.FormatDueLabel(due)} — السبب: {reason}"
            : $"➤ أُعيد توجيه المهمة من «{oldName}» إلى «{newName}» — السبب: {reason}";

    public static List<OperationsTaskCommentFileDto> NormalizeCommentFiles(
        IReadOnlyList<OperationsTaskCommentFileDto>? files) =>
        (files ?? [])
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

    /// <summary>"creator" for manager roles, "assignee" when the actor is the task's assignee, else "creator".</summary>
    public static string CommentAuthor(string actorRole, string entityAssigneeId, string actorAssigneeId) =>
        actorRole is "case-specialist" or "section-supervisor" or "cdo" or "general-manager"
            ? "creator"
            : entityAssigneeId == actorAssigneeId.Trim()
                ? "assignee"
                : "creator";

    public static string CommentText(string? actorName, string text) =>
        text.Length == 0
            ? ""
            : actorName is { Length: > 0 } ? $"{actorName}: {text}" : text;

    /// <summary>Human thread only — system updates / reminders are not counterparty chatter.</summary>
    public static bool IsHumanCommentKind(string kind) => kind is "comment" or "close" or "";

    public static string ReminderCommentText(bool auto) =>
        auto
            ? "⏰ تذكير تلقائي ضمن ساعات العمل (المنفّذ والمنشئ)."
            : "🔔 تم إرسال تذكير فوري إلى المنفّذ.";

    public static string DisplayId(int year, int sequence) => $"T-{year}-{sequence:D4}";

    public static string? Reference(int year, int sequence, bool courtVisit) =>
        courtVisit ? $"خ.ت-{year}-{sequence:D4}" : null;
}
