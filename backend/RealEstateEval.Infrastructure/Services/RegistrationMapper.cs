using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

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
            DistributionAssigneeId = profile.DistributionAssigneeId,
            ReviewerCityCoverage = ParseReviewerCityCoverage(profile.ReviewerCityCoverageJson),
            ContractType = profile.ContractType,
            Status = profile.Status,
            RegistrationSource = profile.RegistrationSource,
            PhoneNumber = user.PhoneNumber,
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

        Add(SecAccount, "مستوى الصلاحيات", profile.PermissionLevel);
        Add(SecAccount, "الجوال", user.PhoneNumber);

        switch (profile.RegistrationSource)
        {
            case RegistrationSource.Hr when profile.HrEmployee is { } hr:
                Add(SecHr, "نوع التوظيف", hr.EmploymentType);
                Add(SecHr, "الإدارة", hr.Department);
                Add(SecHr, "القسم", hr.Section);
                Add(SecHr, "رقم الهوية", hr.NationalId);
                Add(SecHr, "رقم العضوية", hr.EmployeeNumber);
                if (hr.JoinDate is { } join)
                    Add(SecHr, "تاريخ الالتحاق", join.ToString("yyyy/MM/dd"));
                break;

            case RegistrationSource.Proc when profile.ProcProvider is { } proc:
                Add(
                    SecProcIdentity,
                    "نوع المزود",
                    proc.ProviderKind == ProcProviderKind.Organization ? "جهة" : "فرد");
                Add(SecProcIdentity, "الاسم", proc.FullName);
                Add(SecProcIdentity, "اسم الجهة", proc.OrganizationName);
                Add(SecProcIdentity, "المفوض", proc.DelegateName);
                Add(SecProcIdentity, "السجل التجاري", proc.CommercialRegistration);
                Add(SecProcIdentity, "رقم الهوية", proc.NationalId);
                Add(SecProcService, "نوع الخدمة", proc.ServiceType);
                Add(SecProcService, "القطاع", proc.Sector);
                Add(SecProcService, "المنطقة", proc.Region);
                Add(SecProcService, "العنوان", proc.Address);
                Add(SecProcBilling, "البنك", proc.BankName);
                Add(SecProcBilling, "الآيبان", proc.Iban);
                Add(SecProcBilling, "بريد الفوترة", proc.BillingEmail);
                Add(SecProcBilling, "الرقم الضريبي", proc.VatRegistration);
                break;
        }

        return fields;
    }
}
