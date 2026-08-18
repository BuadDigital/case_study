using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Derives party work-completion status for inspector fee ledgers from workflow tasks,
/// field-inspection workspaces, and party submissions.
/// </summary>
public static class InspectorFeeWorkStatusRules
{
    public static bool IsWorkSubmitted(
        Guid workflowTaskId,
        IReadOnlyDictionary<Guid, WorkflowTask> tasks,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (!tasks.TryGetValue(workflowTaskId, out var task))
            return false;

        return ResolveWorkStatus(task, workspaces, submissions) == InspectorFeeWorkStatuses.Done;
    }

    public static string ResolveWorkStatus(
        WorkflowTask task,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (task.Status == WorkflowTaskStatus.Cancelled)
            return InspectorFeeWorkStatuses.Cancelled;

        if (task.Status == WorkflowTaskStatus.Completed)
            return InspectorFeeWorkStatuses.Done;

        if (task.Kind == WorkflowTaskKind.FieldInspection &&
            workspaces.TryGetValue(task.Id, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return InspectorFeeWorkStatuses.Done;
        }

        if (task.Kind is WorkflowTaskKind.EngineeringSurvey or WorkflowTaskKind.GovernmentReview &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return InspectorFeeWorkStatuses.Done;
        }

        return InspectorFeeWorkStatuses.InProgress;
    }

    public static DateTime? ResolveWorkSubmittedAtUtc(
        WorkflowTask task,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (task.Status == WorkflowTaskStatus.Completed)
            return task.UpdatedAtUtc;

        if (task.Kind == WorkflowTaskKind.FieldInspection &&
            workspaces.TryGetValue(task.Id, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return workspace.SubmittedAtUtc ?? workspace.UpdatedAtUtc;
        }

        if (task.Kind is WorkflowTaskKind.EngineeringSurvey or WorkflowTaskKind.GovernmentReview &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return submission.SubmittedAtUtc ?? submission.UpdatedAtUtc;
        }

        return null;
    }
}
