using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Pure decision rules behind the workflow-task lifecycle commands: supervisor gate, reason
/// validation, phase-revert target parsing, cascade selection for slot / property deletion,
/// and the assignee lists that displaced-party notifications fan out to. No ports, no I/O.
/// </summary>
public static class WorkflowTaskLifecycleRules
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private static readonly HashSet<string> SectionSupervisorOrAboveRoles =
        new(StaffRoleIds.SectionSupervisorOrAbove, StringComparer.OrdinalIgnoreCase);

    /// <summary>Reopen / redistribute are section-supervisor-or-above actions.</summary>
    public static bool IsSectionSupervisorOrAbove(string? actorRole) =>
        SectionSupervisorOrAboveRoles.Contains((actorRole ?? "").Trim());

    public static string NormalizeReason(string? reason) => (reason ?? "").Trim();

    /// <summary>
    /// A supervisor reason is mandatory and capped at 500 characters; the messages differ per
    /// command so the caller supplies them. Null when the reason is acceptable.
    /// </summary>
    public static Dictionary<string, string>? ReasonError(
        string reason,
        string requiredMessage,
        string tooLongMessage)
    {
        if (reason.Length == 0)
            return new Dictionary<string, string> { ["reason"] = requiredMessage };
        if (reason.Length > 500)
            return new Dictionary<string, string> { ["reason"] = tooLongMessage };
        return null;
    }

    /// <summary>Title of a slot that just reached the distribution phase.</summary>
    public static string DistributionPhaseTitle(string deed, string po) =>
        $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}";

    /// <summary>Only the two pre-case-study phases can be reverted to.</summary>
    public static bool TryParseRevertTarget(string? targetPhase, out WorkflowTaskPhase target) =>
        WorkflowTaskPhaseValues.TryParse((targetPhase ?? "").Trim().ToLowerInvariant(), out target)
        && target is (WorkflowTaskPhase.Enfath or WorkflowTaskPhase.Bourse);

    public static string RevertTimelineLabel(WorkflowTaskPhase target) =>
        target == WorkflowTaskPhase.Enfath
            ? "إرجاع للبيانات الأولية"
            : "إرجاع لاستعلام البورصة";

    public static bool IsCompletedCaseStudy(WorkflowTask task) =>
        task.Kind == CaseStudyPropertyKind && task.Status == WorkflowTaskStatus.Completed;

    /// <summary>
    /// A supervisor resolved an obstruction and handed the transaction back to the specialist
    /// (or re-targeted it to a new one) — the case-specialist assignee should hear about it.
    /// </summary>
    public static bool ShouldNotifySpecialistReturned(
        WorkflowTask task,
        bool wasBlocked,
        string? previousAssigneeId) =>
        task.Kind == CaseStudyPropertyKind
        && string.Equals(task.AssigneeRole, "case-specialist", StringComparison.OrdinalIgnoreCase)
        && task.Status == WorkflowTaskStatus.Open
        && (wasBlocked || task.AssigneeId != previousAssigneeId);

    /// <summary>Trimmed, non-blank, distinct assignee ids of the given tasks, in first-seen order.</summary>
    public static List<string> DistinctAssigneeIds(IEnumerable<WorkflowTask> tasks) =>
        tasks
            .Select(t => t.AssigneeId?.Trim())
            .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// Deleting a case-study slot removes the slot itself, its party children, and every other
    /// task on the same property. The slot is always part of the result.
    /// </summary>
    public static List<WorkflowTask> SlotCascadeTasks(IEnumerable<WorkflowTask> allForPo, WorkflowTask slot)
    {
        var toRemove = allForPo
            .Where(t =>
                t.Id == slot.Id
                || t.ParentTaskId == slot.Id
                || (slot.PropertyId.HasValue
                    && t.PropertyId == slot.PropertyId
                    && t.Id != slot.Id))
            .ToList();

        if (toRemove.All(t => t.Id != slot.Id))
            toRemove.Add(slot);

        return toRemove;
    }

    /// <summary>Unlinked Enfath slots whose ordinal now exceeds the work order's expected count.</summary>
    public static List<WorkflowTask> ExcessEmptySlots(
        IEnumerable<WorkflowTask> remaining,
        int expectedPropertyCount) =>
        remaining
            .Where(t =>
                t.Kind == CaseStudyPropertyKind
                && t.PropertyId is null
                && t.Phase == WorkflowTaskPhase.Enfath
                && t.PropertyOrdinal > expectedPropertyCount)
            .ToList();

    /// <summary>
    /// Deleting a property removes the tasks linked to it and their children. When the property
    /// has a case-study slot, that slot is kept (the caller resets it) and only its children go;
    /// otherwise every task on the property is a potential parent.
    /// </summary>
    public static List<WorkflowTask> PropertyCascadeTasks(
        IReadOnlyList<WorkflowTask> tasksForPo,
        Guid propertyId,
        WorkflowTask? linkedSlot)
    {
        if (linkedSlot is not null)
        {
            var parentIds = new HashSet<Guid> { linkedSlot.Id };
            return tasksForPo.Where(t =>
                t.Id != linkedSlot.Id &&
                (t.PropertyId == propertyId ||
                 (t.ParentTaskId.HasValue && parentIds.Contains(t.ParentTaskId.Value)))).ToList();
        }

        var propertyTaskIds = tasksForPo
            .Where(t => t.PropertyId == propertyId)
            .Select(t => t.Id)
            .ToHashSet();
        return tasksForPo.Where(t =>
            t.PropertyId == propertyId ||
            (t.ParentTaskId.HasValue && propertyTaskIds.Contains(t.ParentTaskId.Value))).ToList();
    }

    public static WorkflowTask? LinkedSlot(IEnumerable<WorkflowTask> tasksForPo, Guid propertyId) =>
        tasksForPo.FirstOrDefault(t => t.Kind == CaseStudyPropertyKind && t.PropertyId == propertyId);

    /// <summary>Field-inspection submissions own a workspace row that must go with them.</summary>
    public static List<Guid> FieldInspectionTaskIds(IEnumerable<PartyTaskSubmission> submissions) =>
        submissions
            .Where(s => s.Kind == WorkflowTaskKindValues.FieldInspection)
            .Select(s => s.WorkflowTaskId)
            .ToList();
}
