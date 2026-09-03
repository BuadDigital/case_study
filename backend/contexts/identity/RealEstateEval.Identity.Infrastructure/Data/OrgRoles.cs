namespace RealEstateEval.Identity.Domain;

/// <summary>Identity roles for organization setup accounts.</summary>
public static class OrgRoles
{
    public const string Cdo = "CDO";

    public static readonly string[] All = [Cdo];

    public static bool IsOrgRole(string? roleName) =>
        roleName is not null && All.Contains(roleName);
}

/// <summary>Identity roles assigned to created users per owning department.</summary>
public static class DepartmentRoles
{
    public const string Proc = "PROC";

    public static readonly string[] All = [Proc];

    /// <summary>Former identity roles removed from new assignments; stripped on staff sync.</summary>
    public static readonly string[] RetiredIdentityRoles = ["HR", "CRM"];
}
