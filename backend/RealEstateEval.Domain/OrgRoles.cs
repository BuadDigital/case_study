namespace RealEstateEval.Domain;

/// <summary>Identity roles for organization setup accounts.</summary>
public static class OrgRoles
{
    public const string Cdo = "CDO";

    /// <summary>Retired department-admin roles — kept for org-overview labels / legacy rows.</summary>
    public const string HrAdmin = "HrAdmin";
    public const string ProcAdmin = "ProcAdmin";
    public const string CrmAdmin = "CrmAdmin";

    public static readonly string[] All = [Cdo];

    public static readonly string[] RetiredDepartmentAdmins = [HrAdmin, ProcAdmin, CrmAdmin];

    public static bool IsOrgRole(string? roleName) =>
        roleName is not null && All.Contains(roleName);
}

/// <summary>Identity roles assigned to created users per owning department.</summary>
public static class DepartmentRoles
{
    public const string Hr = "HR";
    public const string Proc = "PROC";
    public const string Crm = "CRM";

    public static readonly string[] All = [Hr, Proc, Crm];
}
