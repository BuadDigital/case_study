using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Status transitions, scope validation, due-date defaults, and status comment text
/// for operations tasks.
/// </summary>
public static class OperationsTaskLifecycleRules
{
    public static bool IsManager(string actorRole)
    {
        var role = actorRole.Trim();
        return role is "case-specialist" or "section-supervisor" or "general-manager"
            || string.Equals(role, "cdo", StringComparison.OrdinalIgnoreCase);
    }

    public static string? ValidateScope(
        OperationsTaskScope scope,
        IReadOnlyList<string> deeds,
        string? poNumber) =>
        scope switch
        {
            OperationsTaskScope.Transaction when deeds.Count != 1 =>
                "نطاق المعاملة يتطلب صكاً واحداً",
            OperationsTaskScope.WorkOrder when string.IsNullOrWhiteSpace(poNumber) =>
                "نطاق أمر العمل يتطلب رقم PO",
            OperationsTaskScope.Multi when deeds.Count < 2 =>
                "نطاق عدة معاملات يتطلب صكّين فأكثر",
            _ => null,
        };

    /// <summary>
    /// Authorization plus reachability, returning the user-facing Arabic refusal. The legal edges
    /// themselves live on the aggregate (<see cref="OperationsTask.CanTransitionTo"/>) — this only
    /// decides who may walk them.
    /// </summary>
    public static string? ValidateStatusTransition(
        OperationsTask entity,
        OperationsTaskStatus next,
        string actorAssigneeId,
        string actorRole)
    {
        if (entity.IsTerminal)
            return "المهمة في حالة نهائية";

        var actor = actorAssigneeId.Trim();
        var isManager = IsManager(actorRole);

        if (next == OperationsTaskStatus.InProgress)
        {
            var confirmingReceipt = entity.Status == OperationsTaskStatus.Created;
            if (confirmingReceipt)
            {
                if (entity.AssigneeId != actor)
                    return "هذا الإجراء للمنفّذ المكلّف فقط";
            }
            else if (entity.AssigneeId != actor && !isManager)
            {
                return "هذا الإجراء للمنفّذ المكلّف فقط";
            }
        }

        if (next == OperationsTaskStatus.Completed)
        {
            if (entity.AssigneeId != actor && !isManager)
                return "هذا الإجراء للمنفّذ المكلّف فقط";
        }

        if (next is OperationsTaskStatus.Paused or OperationsTaskStatus.Cancelled && !isManager)
            return "هذا الإجراء للمنشئ أو المشرف فقط";

        return entity.CanTransitionTo(next) ? null : "انتقال حالة غير مسموح";
    }

    public static DateTime DefaultDueAt(OperationsTaskPriority priority, DateTime now) =>
        priority switch
        {
            OperationsTaskPriority.High => now.AddHours(4),
            OperationsTaskPriority.Low => now.AddDays(1),
            _ => now.AddHours(12),
        };

    public static string StatusUpdateText(
        OperationsTaskStatus from,
        OperationsTaskStatus to,
        string? actorName,
        string? pauseReason = null,
        string? cancelReason = null)
    {
        var actor = string.IsNullOrWhiteSpace(actorName) ? "النظام" : actorName.Trim();
        return to switch
        {
            OperationsTaskStatus.InProgress => from == OperationsTaskStatus.Paused
                ? $"{actor} استأنف المهمة"
                : $"{actor} أكّد الاستلام",
            OperationsTaskStatus.Completed => $"{actor} أكمل المهمة",
            OperationsTaskStatus.Paused => string.IsNullOrWhiteSpace(pauseReason)
                ? $"{actor} أوقف المهمة مؤقتاً"
                : $"⏸ {actor} أوقف المهمة مؤقتاً — السبب: {pauseReason.Trim()}",
            OperationsTaskStatus.Cancelled => string.IsNullOrWhiteSpace(cancelReason)
                ? $"{actor} ألغى المهمة"
                : $"✕ {actor} ألغى المهمة — السبب: {cancelReason.Trim()}",
            _ when from == OperationsTaskStatus.Paused => $"{actor} استأنف المهمة",
            _ => $"{actor} غيّر الحالة إلى {to.ToDbValue()}",
        };
    }

    public static void ApplyExecutionCredit(
        OperationsTask entity,
        PatchOperationsTaskRequest request,
        List<OperationsTaskCommentDto> comments,
        DateTime now,
        string? actorName)
    {
        entity.ApplyExecutionCredit(request.CreditAssigneeId, request.CreditAssigneeName, now);

        if (entity.WasReassigned)
        {
            var creditId = entity.CreditAssigneeId ?? "";
            var creditName = entity.CreditAssigneeName ?? "";
            var label = string.IsNullOrWhiteSpace(creditName) ? creditId : creditName;
            var actor = string.IsNullOrWhiteSpace(actorName) ? "النظام" : actorName.Trim();
            comments.Add(new OperationsTaskCommentDto
            {
                Who = "system",
                At = now.ToString("O"),
                Text = $"◎ مسؤولية التنفيذ عند الإغلاق: «{label}» — بواسطة {actor}",
                Kind = "update",
            });
        }
    }
}
