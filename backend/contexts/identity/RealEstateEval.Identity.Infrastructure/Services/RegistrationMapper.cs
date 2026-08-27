using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

public static class RegistrationMapper
{
    private const string SecAccount = "الحساب والصلاحيات";
    private const string SecHr = "بيانات التوظيف";
    private const string SecProcIdentity = "بيانات المزود";
    private const string SecProcService = "الخدمة والموقع";
    private const string SecProcBilling = "الفوترة";

    public static UserListItemDto ToListItem(
        ApplicationUser user,
        UserProfile profile,
        IReadOnlyList<string> systemRoles) =>
        new()
        {
            Id = user.Id,
            DisplayName = user.DisplayName,
            JobTitle = profile.JobTitle,
            Email = user.Email ?? string.Empty,
            UserName = user.UserName ?? string.Empty,
            RoleId = profile.RoleId,
            Mobile = user.PhoneNumber,
            City = profile.City,
            Department = profile.Department,
            NationalId = profile.NationalId,
            AvatarUrl = profile.AvatarUrl,
            InspectorType = profile.InspectorType,
            HasCompensation = profile.HasCompensation,
            FeeValueSar = profile.FeeValueSar,
            Iban = profile.Iban,
            TaxNumber = profile.TaxNumber,
            CommercialRegistration = profile.CommercialRegistration,
            JoinedAt = profile.JoinedAt,
            DistributionAssigneeId = profile.DistributionAssigneeId,
            ReviewerCityCoverage = ParseReviewerCityCoverage(profile.ReviewerCityCoverageJson),
            ContractType = profile.ContractType,
            Status = profile.Status,
            RegistrationSource = profile.RegistrationSource,
            PhoneNumber = user.PhoneNumber,
            LastLoginAtUtc = profile.LastLoginAtUtc,
            CreatedAtUtc = profile.CreatedAtUtc,
            SystemRoles = systemRoles,
            Details = BuildDetails(user, profile),
        };

    private static IReadOnlyList<string> ParseReviewerCityCoverage(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json)?
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c.Trim())
                .ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static IReadOnlyList<UserDetailFieldDto> BuildDetails(
        ApplicationUser user,
        UserProfile profile)
    {
        var fields = new List<UserDetailFieldDto>();

        void Add(string section, string label, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                fields.Add(new UserDetailFieldDto
                {
                    Section = section,
                    Label = label,
                    Value = value.Trim(),
                });
            }
        }

        Add(
            SecAccount,
            "مسار التسجيل",
            profile.RegistrationSource switch
            {
                RegistrationSource.Hr => "موارد بشرية",
                RegistrationSource.Proc => "مقدم خدمة",
                _ => null,
            });
        Add(SecAccount, "المسمى الوظيفي", profile.JobTitle);
        Add(SecAccount, "الدور", profile.RoleId);
        Add(SecAccount, "مستوى الصلاحيات", profile.PermissionLevel);
        Add(SecAccount, "الجوال", user.PhoneNumber);
        Add(SecAccount, "المدينة", profile.City);
        Add(SecAccount, "رقم الهوية", profile.NationalId);
        Add(SecAccount, "الإدارة", profile.Department);
        Add(SecAccount, "نوع المعاين", profile.InspectorType);
        Add(SecProcBilling, "الآيبان", profile.Iban);
        Add(SecProcBilling, "الرقم الضريبي", profile.TaxNumber);
        Add(SecProcIdentity, "السجل التجاري", profile.CommercialRegistration);
        if (profile.FeeValueSar is { } fee)
            Add(SecProcBilling, "قيمة الأتعاب", $"{fee:0.##} ر.س");
        if (profile.JoinedAt is { } joinedAt)
            Add(SecHr, "تاريخ الالتحاق", joinedAt.ToString("yyyy/MM/dd"));

        switch (profile.RegistrationSource)
        {
            case RegistrationSource.Hr when profile.HrEmployee is { } hr:
                Add(SecHr, "نوع التوظيف", hr.EmploymentType);
                Add(SecHr, "القسم", hr.Section);
                Add(SecHr, "رقم العضوية", hr.EmployeeNumber);
                break;

            case RegistrationSource.Proc when profile.ProcProvider is { } proc:
                Add(
                    SecProcIdentity,
                    "نوع المزود",
                    proc.ProviderKind == ProcProviderKind.Organization ? "جهة" : "فرد");
                Add(SecProcIdentity, "الاسم", proc.FullName);
                Add(SecProcIdentity, "اسم الجهة", proc.OrganizationName);
                Add(SecProcIdentity, "المفوض", proc.DelegateName);
                Add(SecProcService, "نوع الخدمة", proc.ServiceType);
                Add(SecProcService, "القطاع", proc.Sector);
                Add(SecProcService, "العنوان", proc.Address);
                Add(SecProcBilling, "البنك", proc.BankName);
                Add(SecProcBilling, "بريد الفوترة", proc.BillingEmail);
                break;
        }

        return fields;
    }
}
