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

        return ResolveWorkStatus(task, workspaces, submissions) == "done";
    }

    public static string ResolveWorkStatus(
        WorkflowTask task,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (task.Status == WorkflowTaskStatus.Cancelled)
            return "cancelled";

        if (task.Status == WorkflowTaskStatus.Completed)
            return "done";

        if (task.Kind == WorkflowTaskKind.FieldInspection &&
            workspaces.TryGetValue(task.Id, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return "done";
        }

        if (task.Kind is WorkflowTaskKind.EngineeringSurvey or WorkflowTaskKind.GovernmentReview &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return "done";
        }

        return "in_progress";
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

        if (task.Kind == WorkflowTaskKind.EngineeringSurvey &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return submission.SubmittedAtUtc ?? submission.UpdatedAtUtc;
        }

        return null;
    }
}
