using RealEstateEval.Domain;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Application.Rules;

internal sealed record StaffRoleDefaults(
    string PermissionLevel,
    string EmploymentType,
    string Department,
    string? Section,
    ContractType ContractType,
    IReadOnlyList<string> IdentityRoles)
{
    public static StaffRoleDefaults? TryFor(string roleId) =>
        StaffRoleCatalog.IsCreatableStaffRoleId(roleId) ? For(roleId) : null;

    public static StaffRoleDefaults For(string roleId) =>
        roleId switch
        {
            StaffRoleIds.Cdo => new(
                "cdo",
                "دوام كامل",
                "الإدارة التنفيذية",
                null,
                ContractType.Internal,
                [OrgRoles.Cdo]),
            StaffRoleIds.GeneralManager => new(
                "مدير",
                "دوام كامل",
                "إدارة التقييم العقاري",
                null,
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.SectionSupervisor => new(
                "مشرف",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                ["Supervisor"]),
            StaffRoleIds.CaseSpecialist => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.GovernmentReviewer => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.CaseStudy,
                "قسم دراسة الحالة",
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.RealEstateAppraiser => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Valuation,
                "قسم تقييم الأفراد",
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.FieldInspector => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Valuation,
                "قسم تقييم الأفراد",
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.FinancialOfficer => new(
                "محرر",
                "دوام كامل",
                SupervisingDepartments.Finance,
                "قسم المحاسبة",
                ContractType.Internal,
                ["Editor"]),
            StaffRoleIds.EngineeringOffice => new(
                "مقدم خدمة",
                "متعاقد",
                SupervisingDepartments.External,
                null,
                ContractType.ServiceProvider,
                [DepartmentRoles.Proc]),
            _ => throw new ArgumentOutOfRangeException(nameof(roleId), roleId, null),
        };
}
