using Microsoft.AspNetCore.Identity;

using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.DependencyInjection;

using RealEstateEval.Domain;



namespace RealEstateEval.Infrastructure.Data;



public static class DataSeeder

{

    private static readonly string[] LegacyRoles =

        ["Admin", "Supervisor", "Editor", "Reader"];



    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)

    {

        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        var db = services.GetRequiredService<ApplicationDbContext>();



        foreach (var role in LegacyRoles.Concat(OrgRoles.All).Concat(DepartmentRoles.All))

        {

            if (!await roleManager.RoleExistsAsync(role))

                await roleManager.CreateAsync(new IdentityRole(role));

        }



        await EnsureLegacyAdminAsync(userManager);



        foreach (var staff in HrStaffSeeds)

        {

            await EnsureHrStaffAsync(userManager, db, staff, cancellationToken);

        }



        await EnsureProcProviderAsync(

            userManager,

            db,

            JeddahSurveyOfficeSeed,

            cancellationToken);

        await EnsurePrototypeModuleDataAsync(db, cancellationToken);

    }

    /// <summary>Re-insert demo survey/valuation/key rows after a full system reset.</summary>
    public static Task ReseedPrototypeModuleDataAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken = default) =>
        EnsurePrototypeModuleDataAsync(db, cancellationToken);



    private static readonly HrStaffSeed[] HrStaffSeeds =

    [

        new(

            "sliman",

            "s.salhy@gmail.com",

            "sliman123",

            "سليمان",

            "مسؤول التحول الرقمي (CDO)",

            "دوام كامل",

            "الإدارة التنفيذية",

            null,

            "cdo",

            ContractType.Internal,

            OrgRoles.Cdo,

            DepartmentRoles.Hr),

        new(

            "alaa",

            "a.alamin@gmail.com",

            "ali123",

            "آلاء قمصاني",

            "أخصائية موارد بشرية",

            "دوام كامل",

            "الإدارة التنفيذية",

            null,

            "مدير",

            ContractType.Internal,

            OrgRoles.HrAdmin,

            DepartmentRoles.Hr),

        new(

            "ali",

            "a.alqadri@gmail.com",

            "ahmad123",

            "علي الأمين",

            "مدير المالية والعقود",

            "دوام كامل",

            "الإدارة المالية",

            "قسم المحاسبة",

            "مدير",

            ContractType.Internal,

            OrgRoles.ProcAdmin,

            DepartmentRoles.Hr),

        new(

            "shahd",

            "g.abdo@gmail.com",

            "gamal123",

            "شهد العماري",

            "مدير علاقات العملاء",

            "دوام كامل",

            "الإدارة التنفيذية",

            null,

            "مدير",

            ContractType.Internal,

            OrgRoles.CrmAdmin,

            DepartmentRoles.Hr),

        new(

            "salam",

            "salam@ejadah.dev",

            "EjadaGM2025!",

            "سالم الغريب",

            "مدير إدارة التقييم العقاري",

            "دوام كامل",

            "إدارة التقييم العقاري",

            null,

            "مدير",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "abdulrahman",

            "abdulrahman@ejadah.dev",

            "EjadaSS2025!",

            "عبدالرحمن النفيعي",

            "مشرف قسم دراسة الحالة",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم دراسة الحالة",

            "مشرف",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Supervisor"),

        new(

            "osama",

            "osama@ejadah.dev",

            "EjadaCS2025!",

            "أسامة الصالحي",

            "أخصائي دراسة حالة",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم دراسة الحالة",

            "محرر",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "feras",

            "feras@ejadah.dev",

            "EjadaCD2025!",

            "فراس كمرين",

            "مراجع حكومي",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم دراسة الحالة",

            "محرر",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "mohammed",

            "valuation@ejadah.dev",

            "EjadaVC2025!",

            "محمد دياب",

            "منسق عمليات التقييم",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم تقييم الأفراد",

            "مشرف",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Supervisor"),

        new(

            "abdullah",

            "abdullah.kathiri@ejadah.dev",

            "EjadaRA2025!",

            "عبدالله الكثيري",

            "مقيم عقاري",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم تقييم الأفراد",

            "محرر",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "ahmed",

            "ahmed@ejadah.dev",

            "EjadaFI2025!",

            "أحمد سعيد",

            "معاين ميداني",

            "متعاون",

            "إدارة التقييم العقاري",

            "قسم تقييم الأفراد",

            "محرر",

            ContractType.Freelance,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "abdullah_m",

            "abdullah.abdulmane@ejadah.dev",

            "EjadaFI2025!",

            "عبدالله عبدالمانع",

            "معاين ميداني",

            "دوام كامل",

            "إدارة التقييم العقاري",

            "قسم تقييم الأفراد",

            "محرر",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

        new(

            "eman",

            "eman@ejadah.dev",

            "EjadaFO2025!",

            "إيمان النهدي",

            "موظف الشؤون المالية",

            "دوام كامل",

            "الإدارة المالية",

            "قسم المحاسبة",

            "محرر",

            ContractType.Internal,

            DepartmentRoles.Hr,

            "Editor"),

    ];



    private static readonly ProcProviderSeed JeddahSurveyOfficeSeed = new(

        "jeddah_survey",

        "survey.jeddah@ejadah.dev",

        "EjadaEO2025!",

        "مكتب جدة للمساحة",

        "مكتب جدة للمساحة",

        "مسح ميداني",

        "مكة المكرمة",

        "عقاري");



    private sealed record HrStaffSeed(

        string LoginUsername,

        string Email,

        string Password,

        string DisplayName,

        string JobTitle,

        string EmploymentType,

        string Department,

        string? Section,

        string PermissionLevel,

        ContractType ContractType,

        params string[] IdentityRoles);



    private sealed record ProcProviderSeed(

        string LoginUsername,

        string Email,

        string Password,

        string UserName,

        string OrganizationName,

        string ServiceType,

        string Region,

        string Sector);



    private static async Task EnsureHrStaffAsync(

        UserManager<ApplicationUser> userManager,

        ApplicationDbContext db,

        HrStaffSeed seed,

        CancellationToken cancellationToken)

    {

        var normalizedEmail = seed.Email.Trim().ToLowerInvariant();

        var user = await userManager.FindByEmailAsync(normalizedEmail);

        if (user is null)

        {

            user = new ApplicationUser

            {

                UserName = seed.LoginUsername,

                Email = normalizedEmail,

                EmailConfirmed = true,

                DisplayName = seed.DisplayName,

            };



            var createResult = await userManager.CreateAsync(user, seed.Password);

            if (!createResult.Succeeded)

            {

                throw new InvalidOperationException(

                    "Failed to seed HR user " + seed.Email + ": "

                    + string.Join("; ", createResult.Errors.Select(e => e.Description)));

            }

        }

        else

        {

            var changed = false;

            if (!string.Equals(user.DisplayName, seed.DisplayName, StringComparison.Ordinal))

            {

                user.DisplayName = seed.DisplayName;

                changed = true;

            }

            if (!string.Equals(user.UserName, seed.LoginUsername, StringComparison.Ordinal))

            {

                user.UserName = seed.LoginUsername;

                changed = true;

            }

            if (changed)

                await userManager.UpdateAsync(user);

        }



        var roles = await userManager.GetRolesAsync(user);

        foreach (var role in seed.IdentityRoles.Distinct())

        {

            if (!roles.Contains(role))

                await userManager.AddToRoleAsync(user, role);

        }



        var profile = await db.UserProfiles

            .Include(p => p.HrEmployee)

            .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);



        if (profile is null)

        {

            profile = new UserProfile

            {

                UserId = user.Id,

                RegistrationSource = RegistrationSource.Hr,

                ContractType = seed.ContractType,

                JobTitle = seed.JobTitle,

                PermissionLevel = seed.PermissionLevel,

                Status = UserStatus.Active,

                CreatedAtUtc = DateTime.UtcNow,

                HrEmployee = new HrEmployeeProfile

                {

                    UserId = user.Id,

                    EmploymentType = seed.EmploymentType,

                    Department = seed.Department,

                    Section = seed.Section,

                },

            };

            db.UserProfiles.Add(profile);

        }

        else

        {

            profile.RegistrationSource = RegistrationSource.Hr;

            profile.ContractType = seed.ContractType;

            profile.JobTitle = seed.JobTitle;

            profile.PermissionLevel = seed.PermissionLevel;

            profile.Status = UserStatus.Active;

            if (profile.ProcProvider is not null)
            {
                db.ProcServiceProviderProfiles.Remove(profile.ProcProvider);
                profile.ProcProvider = null;
            }

            profile.CrmClient = null;

            if (profile.HrEmployee is null)

            {

                profile.HrEmployee = new HrEmployeeProfile { UserId = user.Id };

                db.HrEmployeeProfiles.Add(profile.HrEmployee);

            }



            profile.HrEmployee.EmploymentType = seed.EmploymentType;

            profile.HrEmployee.Department = seed.Department;

            profile.HrEmployee.Section = seed.Section;

        }



        await db.SaveChangesAsync(cancellationToken);

    }



    private static async Task EnsureProcProviderAsync(

        UserManager<ApplicationUser> userManager,

        ApplicationDbContext db,

        ProcProviderSeed seed,

        CancellationToken cancellationToken)

    {

        var normalizedEmail = seed.Email.Trim().ToLowerInvariant();

        var user = await userManager.FindByEmailAsync(normalizedEmail);

        if (user is null)

        {

            user = new ApplicationUser

            {

                UserName = seed.LoginUsername,

                Email = normalizedEmail,

                EmailConfirmed = true,

                DisplayName = seed.OrganizationName,

            };



            var createResult = await userManager.CreateAsync(user, seed.Password);

            if (!createResult.Succeeded)

            {

                throw new InvalidOperationException(

                    "Failed to seed PROC provider " + seed.Email + ": "

                    + string.Join("; ", createResult.Errors.Select(e => e.Description)));

            }

        }

        else

        {

            var changed = false;

            if (!string.Equals(user.DisplayName, seed.OrganizationName, StringComparison.Ordinal))

            {

                user.DisplayName = seed.OrganizationName;

                changed = true;

            }

            if (!string.Equals(user.UserName, seed.LoginUsername, StringComparison.Ordinal))

            {

                user.UserName = seed.LoginUsername;

                changed = true;

            }

            if (changed)

                await userManager.UpdateAsync(user);

        }



        var roles = await userManager.GetRolesAsync(user);

        if (!roles.Contains(DepartmentRoles.Proc))

            await userManager.AddToRoleAsync(user, DepartmentRoles.Proc);



        var profile = await db.UserProfiles

            .Include(p => p.ProcProvider)

            .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);



        if (profile is null)

        {

            profile = new UserProfile

            {

                UserId = user.Id,

                RegistrationSource = RegistrationSource.Proc,

                ContractType = ContractType.ServiceProvider,

                JobTitle = "مقدم خدمة — جهة",

                Status = UserStatus.Active,

                CreatedAtUtc = DateTime.UtcNow,

                ProcProvider = new ProcServiceProviderProfile

                {

                    UserId = user.Id,

                    ProviderKind = ProcProviderKind.Organization,

                    OrganizationName = seed.OrganizationName,

                    ServiceType = seed.ServiceType,

                    Region = seed.Region,

                    Sector = seed.Sector,

                },

            };

            db.UserProfiles.Add(profile);

        }

        else

        {

            profile.RegistrationSource = RegistrationSource.Proc;

            profile.ContractType = ContractType.ServiceProvider;

            profile.JobTitle = "مقدم خدمة — جهة";

            profile.Status = UserStatus.Active;

            if (profile.HrEmployee is not null)
            {
                db.HrEmployeeProfiles.Remove(profile.HrEmployee);
                profile.HrEmployee = null;
            }

            profile.CrmClient = null;

            if (profile.ProcProvider is null)

            {

                profile.ProcProvider = new ProcServiceProviderProfile { UserId = user.Id };

                db.ProcServiceProviderProfiles.Add(profile.ProcProvider);

            }



            profile.ProcProvider.ProviderKind = ProcProviderKind.Organization;

            profile.ProcProvider.OrganizationName = seed.OrganizationName;

            profile.ProcProvider.ServiceType = seed.ServiceType;

            profile.ProcProvider.Region = seed.Region;

            profile.ProcProvider.Sector = seed.Sector;

        }



        await db.SaveChangesAsync(cancellationToken);

    }



    private static async Task EnsureLegacyAdminAsync(UserManager<ApplicationUser> userManager)

    {

        const string email = "admin@local.dev";

        if (await userManager.FindByEmailAsync(email) is not null)

            return;



        var user = new ApplicationUser

        {

            UserName = email,

            Email = email,

            EmailConfirmed = true,

            DisplayName = "سالم الغريب",

        };



        const string password = "Admin123!";

        var result = await userManager.CreateAsync(user, password);

        if (!result.Succeeded)

        {

            throw new InvalidOperationException(

                "Failed to seed default user: "

                + string.Join("; ", result.Errors.Select(e => e.Description)));

        }



        await userManager.AddToRoleAsync(user, "Admin");

    }

    private static async Task EnsurePrototypeModuleDataAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        if (!await db.SurveyOffices.AnyAsync(cancellationToken))
        {
            var now = DateTime.UtcNow;
            db.SurveyOffices.AddRange(
                new SurveyOffice
                {
                    Id = Guid.Parse("a1000001-0000-4000-8000-000000000001"),
                    Name = "مكتب الرياض الهندسي",
                    ActiveCount = 12,
                    DoneMonth = 34,
                    AvgDaysLabel = "3.2 يوم",
                    ContractLabel = "اتفاقية سنوية",
                    StatusBusy = false,
                    SortOrder = 1,
                    UpdatedAtUtc = now,
                },
                new SurveyOffice
                {
                    Id = Guid.Parse("a1000001-0000-4000-8000-000000000002"),
                    Name = "مكتب جدة للمساحة",
                    ActiveCount = 8,
                    DoneMonth = 28,
                    AvgDaysLabel = "2.8 يوم",
                    ContractLabel = "اتفاقية سنوية",
                    StatusBusy = false,
                    SortOrder = 2,
                    UpdatedAtUtc = now,
                },
                new SurveyOffice
                {
                    Id = Guid.Parse("a1000001-0000-4000-8000-000000000003"),
                    Name = "مكتب مكة الهندسي",
                    ActiveCount = 7,
                    DoneMonth = 22,
                    AvgDaysLabel = "3.5 يوم",
                    ContractLabel = "اتفاقية سنوية",
                    StatusBusy = false,
                    SortOrder = 3,
                    UpdatedAtUtc = now,
                },
                new SurveyOffice
                {
                    Id = Guid.Parse("a1000001-0000-4000-8000-000000000004"),
                    Name = "مكتب الطائف التقني",
                    ActiveCount = 4,
                    DoneMonth = 14,
                    AvgDaysLabel = "4.1 يوم",
                    ContractLabel = "اتفاقية سنوية",
                    StatusBusy = true,
                    SortOrder = 4,
                    UpdatedAtUtc = now,
                });
        }

        if (!await db.ValuationRequests.AnyAsync(cancellationToken))
        {
            var now = DateTime.UtcNow;
            db.ValuationRequests.AddRange(
                new ValuationRequest
                {
                    Id = Guid.Parse("b2000001-0000-4000-8000-000000000001"),
                    DisplayId = "VR-441",
                    PropertyId = "E-4401",
                    Area = "مكة المكرمة",
                    PropertyType = "أرض",
                    Appraiser = "عبدالله الكثيري",
                    Status = "done",
                    RequestDate = "2025-01-13",
                    UpdatedAtUtc = now,
                },
                new ValuationRequest
                {
                    Id = Guid.Parse("b2000001-0000-4000-8000-000000000002"),
                    DisplayId = "VR-442",
                    PropertyId = "E-4402",
                    Area = "مكة المكرمة",
                    PropertyType = "شقة",
                    Appraiser = "محمد العساف",
                    Status = "progress",
                    RequestDate = "2025-01-14",
                    UpdatedAtUtc = now,
                },
                new ValuationRequest
                {
                    Id = Guid.Parse("b2000001-0000-4000-8000-000000000003"),
                    DisplayId = "VR-443",
                    PropertyId = "E-4403",
                    Area = "جدة",
                    PropertyType = "فيلا",
                    Appraiser = "عبدالله الكثيري",
                    Status = "done",
                    RequestDate = "2025-01-12",
                    UpdatedAtUtc = now,
                },
                new ValuationRequest
                {
                    Id = Guid.Parse("b2000001-0000-4000-8000-000000000004"),
                    DisplayId = "VR-444",
                    PropertyId = "E-4405",
                    Area = "الطائف",
                    PropertyType = "عمارة",
                    Appraiser = "محمد العساف",
                    Status = "progress",
                    RequestDate = "2025-01-14",
                    UpdatedAtUtc = now,
                });
        }

        if (!await db.PropertyKeyRecords.AnyAsync(cancellationToken))
        {
            var now = DateTime.UtcNow;
            db.PropertyKeyRecords.AddRange(
                new PropertyKeyRecord
                {
                    Id = Guid.Parse("c3000001-0000-4000-8000-000000000001"),
                    PropertyId = "E-4402",
                    PoNumber = "PO-2024-018",
                    Area = "مكة المكرمة",
                    PropertyType = "شقة",
                    HasKey = true,
                    Specialist = "أسامة الصالحي",
                    WorkflowStatus = "progress",
                    UpdatedAtUtc = now,
                },
                new PropertyKeyRecord
                {
                    Id = Guid.Parse("c3000001-0000-4000-8000-000000000002"),
                    PropertyId = "E-4403",
                    PoNumber = "PO-2024-016",
                    Area = "جدة",
                    PropertyType = "فيلا",
                    HasKey = true,
                    Specialist = "أيمن مجرشي",
                    WorkflowStatus = "done",
                    UpdatedAtUtc = now,
                },
                new PropertyKeyRecord
                {
                    Id = Guid.Parse("c3000001-0000-4000-8000-000000000003"),
                    PropertyId = "E-4407",
                    PoNumber = "PO-2024-016",
                    Area = "جدة",
                    PropertyType = "أرض",
                    HasKey = true,
                    Specialist = "أيمن مجرشي",
                    WorkflowStatus = "progress",
                    UpdatedAtUtc = now,
                });
        }

        if (!await db.FinancialReportConfigs.AnyAsync(cancellationToken))
        {
            db.FinancialReportConfigs.Add(new FinancialReportConfig
            {
                Id = Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890"),
                ReportJson = FinancialReportSeedJson,
                UpdatedAtUtc = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private const string FinancialReportSeedJson = """
        {"periodLabel":"يناير","revenueTotal":"312,400","externalCostsTotal":"87,600","profitMarginTotal":"224,800","profitMarginPercentLabel":"72% من الإيرادات","pendingPayablesTotal":"43,200","revenueGrandTotal":"55,800 ر","revenueRows":[{"po":"PO-2024-014","billed":8,"excluded":0,"value":"18,400 ر","status":"done"},{"po":"PO-2024-015","billed":1,"excluded":0,"value":"2,200 ر","status":"done"},{"po":"PO-2024-017","billed":3,"excluded":0,"value":"6,600 ر","status":"done"},{"po":"PO-2024-016","billed":13,"excluded":2,"value":"28,600 ر","status":"progress"}],"costRows":[{"name":"مكتب الرياض الهندسي","type":"ext","cost":"18,400 ر","category":"رفع مساحي"},{"name":"عبدالله الكثيري","type":"int","cost":"12,000 ر","category":"تقييم"},{"name":"حسن عطية","type":"free","cost":"3,200 ر","category":"معاينة"}]}
        """;

}


