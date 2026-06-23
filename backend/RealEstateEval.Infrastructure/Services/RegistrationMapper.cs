using System.Text.Json;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public static class RegistrationMapper
{
    private static string Get(RegistrationPayloadDto data, string key) =>
        data.TryGetValue(key, out var v) ? v.Trim() : string.Empty;

    private static string? GetOptional(RegistrationPayloadDto data, string key)
    {
        var v = Get(data, key);
        return string.IsNullOrEmpty(v) ? null : v;
    }

    private static DateOnly? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateOnly.TryParse(value, out var d) ? d : null;
    }

    private const string SecAccount = "الحساب والصلاحيات";
    private const string SecHr = "بيانات التوظيف";
    private const string SecProcIdentity = "بيانات المزود";
    private const string SecProcService = "الخدمة والموقع";
    private const string SecProcBilling = "الفوترة";
    private const string SecCrmClass = "تصنيف العميل";
    private const string SecCrmBasic = "البيانات الأساسية";
    private const string SecCrmContact = "التواصل";
    private const string SecSystem = "النظام";

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
            Details = BuildDetails(user, profile, systemRoles),
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

    public static string MapRoleToArabic(string roleName) =>
        roleName switch
        {
            "Admin" => "مدير النظام",
            "Supervisor" => "مشرف",
            "Editor" => "محرر",
            "Reader" => "قارئ",
            OrgRoles.Cdo => "مسؤول التحول الرقمي (CDO)",
            OrgRoles.HrAdmin => "أخصائية موارد بشرية",
            OrgRoles.ProcAdmin => "مدير المالية والعقود",
            OrgRoles.CrmAdmin => "مدير علاقات العملاء",
            DepartmentRoles.Hr => "دور الموارد البشرية (HR)",
            DepartmentRoles.Proc => "دور المالية والعقود (PROC)",
            DepartmentRoles.Crm => "دور علاقات العملاء (CRM)",
            _ => roleName,
        };

    public static IReadOnlyList<UserDetailFieldDto> BuildDetails(
        ApplicationUser user,
        UserProfile profile,
        IReadOnlyList<string> systemRoles)
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
                RegistrationSource.Crm => "عميل",
                _ => null,
            });
        Add(SecAccount, "اسم المستخدم", user.UserName);
        if (systemRoles.Count > 0)
        {
            Add(
                SecAccount,
                "دور النظام",
                string.Join("، ", systemRoles.Select(MapRoleToArabic)));
        }

        Add(SecAccount, "مستوى الصلاحيات", profile.PermissionLevel);
        Add(SecAccount, "الجوال", user.PhoneNumber);

        switch (profile.RegistrationSource)
        {
            case RegistrationSource.Hr when profile.HrEmployee is { } hr:
                Add(SecHr, "نوع التوظيف", hr.EmploymentType);
                Add(SecHr, "الإدارة", hr.Department);
                Add(SecHr, "القسم", hr.Section);
                Add(SecHr, "رقم الهوية", hr.NationalId);
                Add(SecHr, "رقم الموظف", hr.EmployeeNumber);
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

            case RegistrationSource.Crm when profile.CrmClient is { } crm:
                Add(
                    SecCrmClass,
                    "نوع الكيان",
                    crm.EntityKind == CrmEntityKind.Company ? "شركة" : "فرد");
                Add(
                    SecCrmClass,
                    "حالة العميل",
                    crm.ClientStatus == CrmClientStatus.Lead ? "عميل محتمل" : "عميل فعلي");
                Add(
                    SecCrmClass,
                    "نوع العميل",
                    crm.ClientType == CrmClientType.Contract ? "بعقد" : "مباشر");
                Add(SecCrmBasic, "الاسم", crm.FullName);
                Add(SecCrmBasic, "اسم المنشأة", crm.OrganizationName);
                Add(SecCrmBasic, "السجل التجاري", crm.CommercialRegistration);
                Add(SecCrmBasic, "رقم الهوية", crm.NationalId);
                Add(SecCrmBasic, "المنطقة", crm.Region);
                Add(SecCrmBasic, "القطاع", crm.Sector);
                Add(SecCrmBasic, "العنوان", crm.Address);
                Add(SecCrmBasic, "ممثل الحساب", crm.AccountRepresentative);
                Add(SecCrmBasic, "الرقم الضريبي", crm.VatRegistration);
                Add(SecCrmContact, "جهة التواصل", crm.ContactPerson);
                Add(SecCrmContact, "دور جهة التواصل", crm.ContactRole);
                Add(SecCrmContact, "جوال جهة التواصل", crm.ContactPhone);
                break;
        }

        Add(SecSystem, "معرّف المستخدم", user.Id);
        Add(
            SecSystem,
            "تاريخ التسجيل",
            profile.CreatedAtUtc.ToLocalTime().ToString("yyyy/MM/dd HH:mm"));
        return fields;
    }

    public static (ApplicationUser User, UserProfile Profile, HrEmployeeProfile Hr) MapHr(
        RegistrationPayloadDto data)
    {
        var email = Get(data, "hr_email").ToLowerInvariant();
        var displayName = Get(data, "hr_name");
        var empType = Get(data, "hr_empType");
        var isFreelance = empType == "متعاون";
        var jobTitle = Get(data, "hr_jobTitle");
        if (string.IsNullOrEmpty(jobTitle))
            jobTitle = Get(data, "hr_perms");
        if (string.IsNullOrEmpty(jobTitle))
            jobTitle = "موظف";

        var user = new ApplicationUser
        {
            UserName = Get(data, "hr_username"),
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = GetOptional(data, "hr_phone"),
            DisplayName = displayName,
        };

        var profile = new UserProfile
        {
            RegistrationSource = RegistrationSource.Hr,
            ContractType = isFreelance ? ContractType.Freelance : ContractType.Internal,
            JobTitle = jobTitle,
            PermissionLevel = GetOptional(data, "hr_perms"),
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var hr = new HrEmployeeProfile
        {
            EmploymentType = empType,
            Department = Get(data, "hr_dept"),
            Section = GetOptional(data, "hr_section"),
            NationalId = GetOptional(data, "hr_idno"),
            EmployeeNumber = GetOptional(data, "hr_empNo"),
            JoinDate = ParseDate(GetOptional(data, "hr_joinDate")),
        };

        return (user, profile, hr);
    }

    public static (ApplicationUser User, UserProfile Profile, ProcServiceProviderProfile Proc) MapProc(
        RegistrationPayloadDto data)
    {
        var isOrg = Get(data, "subtype") == "org";
        var email = Get(data, "pc_email").ToLowerInvariant();

        string displayName;
        string jobTitle;
        ContractType contractType;

        if (isOrg)
        {
            displayName = Get(data, "pc_delegate");
            if (string.IsNullOrEmpty(displayName))
                displayName = Get(data, "pc_orgname");
            jobTitle = "مقدم خدمة — جهة";
            contractType = ContractType.ServiceProvider;
        }
        else
        {
            displayName = Get(data, "pc_name");
            jobTitle = Get(data, "pc_service");
            if (string.IsNullOrEmpty(jobTitle))
                jobTitle = "مقدم خدمة — فرد";
            contractType = ContractType.Freelance;
        }

        var user = new ApplicationUser
        {
            UserName = Get(data, "pc_username"),
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = GetOptional(data, "pc_phone"),
            DisplayName = displayName,
        };

        var profile = new UserProfile
        {
            RegistrationSource = RegistrationSource.Proc,
            ContractType = contractType,
            JobTitle = jobTitle,
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var proc = new ProcServiceProviderProfile
        {
            ProviderKind = isOrg ? ProcProviderKind.Organization : ProcProviderKind.Individual,
            FullName = GetOptional(data, "pc_name"),
            OrganizationName = GetOptional(data, "pc_orgname"),
            CommercialRegistration = GetOptional(data, "pc_crn"),
            DelegateName = GetOptional(data, "pc_delegate"),
            NationalId = GetOptional(data, "pc_idno"),
            ServiceType = Get(data, "pc_service"),
            Sector = GetOptional(data, "pc_sector"),
            Address = GetOptional(data, "pc_address"),
            Region = GetOptional(data, "pc_region"),
            BankName = GetOptional(data, "pc_bankname"),
            Iban = GetOptional(data, "pc_iban"),
            BillingEmail = GetOptional(data, "pc_billingemail"),
            VatRegistration = GetOptional(data, "pc_vatreg"),
        };

        return (user, profile, proc);
    }

    public static (ApplicationUser User, UserProfile Profile, CrmClientProfile Crm) MapCrm(
        RegistrationPayloadDto data)
    {
        var isCompany = Get(data, "entitySubtype") == "company";
        var email = Get(data, "crm_email").ToLowerInvariant();
        var displayName = isCompany
            ? Get(data, "crm_orgname")
            : Get(data, "crm_name");
        if (string.IsNullOrEmpty(displayName))
            displayName = Get(data, "crm_name");

        var clientStatus = Get(data, "clientStatus");
        var clientType = Get(data, "clientType");
        var jobTitle = CrmTypeLabel(clientStatus, clientType);

        var user = new ApplicationUser
        {
            UserName = Get(data, "crm_username"),
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = GetOptional(data, "crm_phone"),
            DisplayName = displayName,
        };

        var profile = new UserProfile
        {
            RegistrationSource = RegistrationSource.Crm,
            ContractType = ContractType.ServiceProvider,
            JobTitle = jobTitle,
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var crm = new CrmClientProfile
        {
            EntityKind = isCompany ? CrmEntityKind.Company : CrmEntityKind.Individual,
            ClientStatus = clientStatus == "active" ? CrmClientStatus.Active : CrmClientStatus.Lead,
            ClientType = clientType == "contract" ? CrmClientType.Contract : CrmClientType.Direct,
            FullName = GetOptional(data, "crm_name"),
            OrganizationName = GetOptional(data, "crm_orgname"),
            CommercialRegistration = GetOptional(data, "crm_crn"),
            NationalId = GetOptional(data, "crm_idno"),
            Region = GetOptional(data, "crm_region"),
            Sector = GetOptional(data, "crm_sector"),
            Address = GetOptional(data, "crm_address"),
            AccountRepresentative = GetOptional(data, "crm_rep"),
            VatRegistration = GetOptional(data, "crm_vatreg"),
            ContactPerson = GetOptional(data, "crm_contactPerson"),
            ContactRole = GetOptional(data, "crm_contactRole"),
            ContactPhone = GetOptional(data, "crm_contactPhone"),
        };

        return (user, profile, crm);
    }

    private static string CrmTypeLabel(string clientStatus, string clientType)
    {
        if (clientStatus == "lead") return "عميل محتمل";
        var sub = clientType == "contract" ? "بعقد" : "مباشر";
        return $"عميل فعلي — {sub}";
    }

    public static string? MapPermissionToRole(string? permission) =>
        permission switch
        {
            "مدير" => "Admin",
            "مشرف" => "Supervisor",
            "محرر" => "Editor",
            "قارئ" => "Reader",
            _ => null,
        };
}
