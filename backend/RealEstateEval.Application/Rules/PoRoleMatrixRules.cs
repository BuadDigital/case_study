namespace RealEstateEval.Application.Rules;

/// <summary>
/// Authoritative PO / property / party-submission role matrix —
/// mirrors frontend <c>po-roles.ts</c> and <c>operations-task-roles.ts</c>.
/// </summary>
public static class PoRoleMatrixRules
{
    public static bool IsSuperAdmin(string? prototypeRole) =>
        string.Equals(prototypeRole?.Trim(), "cdo", StringComparison.OrdinalIgnoreCase);

    public static bool CanReceivePo(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "section-supervisor" or "case-specialist";
    }

    public static bool CanEditPoHeader(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "section-supervisor";
    }

    public static bool CanEditProperty(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "case-specialist";
    }

    public static bool CanDeletePo(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "section-supervisor";
    }

    public static bool CanDeleteProperty(string? prototypeRole) => CanDeletePo(prototypeRole);

 /// <summary>Specialist accept / reopen of party submissions.</summary>
    public static bool CanManagePartySubmissions(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "case-specialist" or "section-supervisor" or "general-manager";
    }

 /// <summary>Operations-task managers (matches frontend <c>canManageOperationsTasks</c>).</summary>
    public static bool CanManageOperationsTasks(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "case-specialist" or "section-supervisor" or "general-manager";
    }

 /// <summary>
 /// Party draft/submit: assigned party, or CDO / section supervisor override.
 /// </summary>
    public static bool CanWritePartyTask(
        string? prototypeRole,
        string? taskAssigneeId,
        string? actorUserId,
        string? actorDistributionAssigneeId)
    {
        if (IsSuperAdmin(prototypeRole)
            || string.Equals(Normalize(prototypeRole), "section-supervisor", StringComparison.Ordinal))
        {
            return true;
        }

        var assignee = taskAssigneeId?.Trim() ?? "";
        if (assignee.Length == 0) return false;

        var dist = actorDistributionAssigneeId?.Trim() ?? "";
        if (dist.Length > 0 && string.Equals(dist, assignee, StringComparison.Ordinal))
            return true;

        var userId = actorUserId?.Trim() ?? "";
        return userId.Length > 0
            && string.Equals(userId, assignee, StringComparison.Ordinal);
    }

 /// <summary>
 /// Case-study staff may correct a submitted field-inspection package
 /// (e.g. map pin) without being the inspector assignee.
 /// </summary>
    public static bool CanCorrectFieldInspectionSubmission(string? prototypeRole) =>
        CanManagePartySubmissions(prototypeRole);

 /// <summary>
 /// Party read access: case staff read every task, parties read only their own.
 /// Strictly wider than <see cref="CanWritePartyTask"/>.
 /// </summary>
    public static bool CanReadPartyTask(
        string? prototypeRole,
        string? taskAssigneeId,
        string? actorUserId,
        string? actorDistributionAssigneeId)
    {
        return CanManagePartySubmissions(prototypeRole)
            || CanWritePartyTask(
                prototypeRole,
                taskAssigneeId,
                actorUserId,
                actorDistributionAssigneeId);
    }

    static string Normalize(string? prototypeRole) =>
        prototypeRole?.Trim().ToLowerInvariant() ?? "";
}
