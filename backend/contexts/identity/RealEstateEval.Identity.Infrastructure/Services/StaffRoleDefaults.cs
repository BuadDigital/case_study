using RealEstateEval.Domain;
using RealEstateEval.Identity.Infrastructure.Permissions;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

internal sealed record StaffRoleDefaults(
    string PermissionLevel,
    string EmploymentType,
    string Department,
    string? Section,
    ContractType ContractType,
    IReadOnlyList<string> IdentityRoles)
{
    public static StaffRoleDefaults? TryFor(string roleId) =>
        PrototypeRoleResolver.IsCreatableStaffRoleId(roleId) ? For(roleId) : null;

    public static StaffRoleDefaults For(string roleId) =>
        roleId switch
        {
            "cdo" => new(
                "cdo",
                "دوام كامل",
                "الإدارة التنفيذية",
                null,
                ContractType.Internal,
                [OrgRoles.Cdo, DepartmentRoles.Hr]),
            "general-manager" => new(
                "مدير",
                "دوام كامل",
                "إدارة التقييم العقاري",
                null,
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "section-supervisor" => new(
                "مشرف",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Supervisor"]),
            "case-specialist" => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "government-reviewer" => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "real-estate-appraiser" => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Valuation,
                "قسم تقييم الأفراد",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "field-inspector" => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Valuation,
                "قسم تقييم الأفراد",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "financial-officer" => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Finance,
                "قسم المحاسبة",
                ContractType.Internal,
                [DepartmentRoles.Hr, "Editor"]),
            "engineering-office" => new(
                "مقدم خدمة",
                "متعاقد",
                SupervisingDepartments.External,
                null,
                ContractType.ServiceProvider,
                [DepartmentRoles.Proc]),
            _ => throw new ArgumentOutOfRangeException(nameof(roleId), roleId, null),
        };
}
