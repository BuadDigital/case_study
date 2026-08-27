using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Rules;

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
        string actorRole,
        string? actorName = null,
        string? pauseReason = null)
    {
        if (entity.IsTerminal)
            return "المهمة في حالة نهائية";

        var actor = actorAssigneeId.Trim();
        var isManager = IsManager(actorRole);
        var isAssignee = actor.Length > 0
            && string.Equals(entity.AssigneeId, actor, StringComparison.OrdinalIgnoreCase);
        if (!isAssignee && !string.IsNullOrWhiteSpace(actorName))
        {
            isAssignee = string.Equals(
                (entity.AssigneeName ?? "").Trim(),
                actorName.Trim(),
                StringComparison.Ordinal);
        }

        if (next == OperationsTaskStatus.InProgress)
        {
            var confirmingReceipt = entity.Status == OperationsTaskStatus.Created;
            if (confirmingReceipt)
            {
                if (!isAssignee)
                    return "هذا الإجراء للمنفّذ المكلّف فقط";
            }
            else if (!isAssignee && !isManager)
            {
                return "هذا الإجراء للمنفّذ المكلّف فقط";
            }
        }

        if (next == OperationsTaskStatus.Completed)
        {
            if (!isAssignee && !isManager)
                return "هذا الإجراء للمنفّذ المكلّف فقط";
        }

        if (next == OperationsTaskStatus.Cancelled && !isManager)
            return "هذا الإجراء للمنشئ أو المشرف فقط";

 // Managers pause anytime; the assignee may pause only when reporting an
 // active property failure (تعذر) so the task leaves their active queue.
        if (next == OperationsTaskStatus.Paused && !isManager)
        {
            if (!isAssignee || !IsFailureObstructionPauseReason(pauseReason))
                return "هذا الإجراء للمنشئ أو المشرف فقط";
        }

 // Reopen as «منشأة» after a failure is cleared — managers anytime;
 // the assignee only when the pause was a failure obstruction.
        if (next == OperationsTaskStatus.Created)
        {
            if (entity.Status != OperationsTaskStatus.Paused)
                return "انتقال حالة غير مسموح";
            if (!isManager)
            {
                if (!isAssignee || !IsFailureObstructionPauseReason(entity.PauseReason))
                    return "هذا الإجراء للمنفّذ المكلّف أو المشرف فقط";
            }
        }

        return entity.CanTransitionTo(next) ? null : "انتقال حالة غير مسموح";
    }

 /// <summary>
 /// Pause reasons used when a linked property has an open failure (تعذر) —
 /// must stay in sync with the front-end <c>OPS_TASK_FAILURE_PAUSE_REASON</c>.
 /// </summary>
    public static bool IsFailureObstructionPauseReason(string? pauseReason)
    {
        var reason = pauseReason?.Trim() ?? "";
        return reason.StartsWith("تعذر نشط", StringComparison.Ordinal);
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
            OperationsTaskStatus.Created when from == OperationsTaskStatus.Paused =>
                $"{actor} أعاد فتح المهمة من جديد بعد رفع التعذر",
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
