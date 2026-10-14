using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>How far a caller may write a property's building inventory.</summary>
public enum BuildingInventoryWriteAccess
{
    /// <summary>No write.</summary>
    Denied = 0,

    /// <summary>Case staff: the table and the specialist's «مكونات العقار» text.</summary>
    Staff = 1,

    /// <summary>The assigned field inspector, before his inspection is submitted: the table only.</summary>
    Inspector = 2,
}

/// <summary>
/// One field-inspection task of a property as the inventory write rule sees it: who it is
/// assigned to and the status of its party package (null = no package row yet, i.e. a draft).
/// </summary>
public sealed record FieldInspectionWriteFacts(string? AssigneeId, string? SubmissionStatus);

/// <summary>
/// Who may write a property's building inventory. Case staff (the same set that manages party
/// submissions) always may; the field inspector may only on a property whose inspection task is
/// assigned to him and only until he submits it (a draft, or a package returned for correction,
/// is open). Everyone else — another inspector, the engineering office, appraisers — is denied.
/// </summary>
public static class BuildingInventoryWriteRules
{
    public const string FieldInspectorRole = "field-inspector";

    public const string PackageSubmitted = "المعاينة أُرسلت — لا يمكن تعديل الحصر";

    /// <summary>
    /// Pure decision from the role, the caller's identities and the property's field-inspection
    /// tasks (cancelled ones already left out by the repository).
    /// </summary>
    public static BuildingInventoryWriteAccess Resolve(
        string? prototypeRole,
        string? actorUserId,
        string? actorDistributionAssigneeId,
        IReadOnlyCollection<FieldInspectionWriteFacts> inspectionTasks)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(prototypeRole))
            return BuildingInventoryWriteAccess.Staff;

        if (!string.Equals(prototypeRole?.Trim(), FieldInspectorRole, StringComparison.OrdinalIgnoreCase))
            return BuildingInventoryWriteAccess.Denied;

        var canWrite = inspectionTasks.Any(task =>
            task.SubmissionStatus != PartyTaskSubmissionStatus.Submitted
            && PoRoleMatrixRules.CanWritePartyTask(
                prototypeRole,
                task.AssigneeId,
                actorUserId,
                actorDistributionAssigneeId));
        return canWrite
            ? BuildingInventoryWriteAccess.Inspector
            : BuildingInventoryWriteAccess.Denied;
    }

    /// <summary>
    /// The inspector's read scope: the property of an inspection task assigned to him, in any
    /// package state (he keeps seeing the inventory after submitting). Case staff and every role
    /// other than the field inspector keep the broader read the endpoint's policy already gives.
    /// </summary>
    public static bool InspectorMayRead(
        string? prototypeRole,
        string? actorUserId,
        string? actorDistributionAssigneeId,
        IReadOnlyCollection<FieldInspectionWriteFacts> inspectionTasks) =>
        !string.Equals(prototypeRole?.Trim(), FieldInspectorRole, StringComparison.OrdinalIgnoreCase)
        || inspectionTasks.Any(task => PoRoleMatrixRules.CanWritePartyTask(
            prototypeRole,
            task.AssigneeId,
            actorUserId,
            actorDistributionAssigneeId));
}
