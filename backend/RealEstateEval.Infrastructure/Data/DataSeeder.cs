using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Infrastructure.Data;

public static class DataSeeder

{
    private const string LogCategory = "RealEstateEval.DataSeeder";

    private static readonly string[] LegacyRoles =

        ["Admin", "Supervisor", "Editor", "Reader"];



    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)

    {

        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        var db = services.GetRequiredService<ApplicationDbContext>();

        var logger = services.GetService<ILoggerFactory>()?.CreateLogger(LogCategory)
            ?? NullLogger.Instance;



        if (await IsAlreadySeededAsync(services, cancellationToken))
        {
            // Keep seed passwords/profile fields in sync on every demo startup.
            await EnsureLegacyAdminAsync(userManager);
            foreach (var staff in HrStaffSeeds)
                await EnsureHrStaffAsync(userManager, db, staff, cancellationToken);
            await EnsureProcProviderAsync(
                userManager,
                db,
                JeddahSurveyOfficeSeed,
                cancellationToken);
            await BackfillReviewerCityCoverageAsync(db, userManager, cancellationToken);
            await BackfillDistributionAssigneeIdsAsync(db, userManager, cancellationToken);
            try
            {
                await BackfillPartyChildAssigneeIdsAsync(db, logger, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "BackfillPartyChildAssigneeIds skipped.");
            }
            await RemoveDemoPropertyKeyRecordsAsync(db, cancellationToken);
            await RemoveSeededFinancialReportConfigAsync(db, cancellationToken);
            await RemoveRetiredOrgAdminUsersAsync(userManager, cancellationToken);
            return;
        }



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

    /// <summary>
    /// Quick check used on startup to skip the full demo seed when data already exists.
    /// </summary>
    public static async Task<bool> IsAlreadySeededAsync(
        IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var db = services.GetRequiredService<ApplicationDbContext>();

        var markerUser = await userManager.FindByNameAsync("sliman");
        if (markerUser is null)
            return false;

        return await db.SurveyOffices.AnyAsync(cancellationToken);
    }

    /// <summary>Re-insert demo survey/valuation rows after a full system reset.</summary>
    public static Task ReseedPrototypeModuleDataAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken = default) =>
        EnsurePrototypeModuleDataAsync(db, cancellationToken);

    /// <summary>Re-create all seeded HR staff and proc demo accounts (idempotent).</summary>
    public static async Task ReseedAllDemoUsersAsync(
        IServiceProvider services,
        CancellationToken cancellationToken = default)
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

        await RemoveRetiredOrgAdminUsersAsync(userManager, cancellationToken);

        foreach (var staff in HrStaffSeeds)
            await EnsureHrStaffAsync(userManager, db, staff, cancellationToken);

        await EnsureProcProviderAsync(
            userManager,
            db,
            JeddahSurveyOfficeSeed,
            cancellationToken);
    }

    /// <summary>Re-create a seeded HR demo account by login username (e.g. ahmed).</summary>
    public static async Task ReseedHrStaffByLoginAsync(
        IServiceProvider services,
        string loginUsername,
        CancellationToken cancellationToken = default)
    {
        var seed = HrStaffSeeds.FirstOrDefault(s =>
            string.Equals(s.LoginUsername, loginUsername.Trim(), StringComparison.OrdinalIgnoreCase));
        if (seed is null)
            throw new InvalidOperationException("Unknown HR seed login: " + loginUsername);

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var db = services.GetRequiredService<ApplicationDbContext>();
        await EnsureHrStaffAsync(userManager, db, seed, cancellationToken);
    }

    private static readonly Guid[] DemoPropertyKeyIds =
    [
        Guid.Parse("c3000001-0000-4000-8000-000000000001"),
        Guid.Parse("c3000001-0000-4000-8000-000000000002"),
        Guid.Parse("c3000001-0000-4000-8000-000000000003"),
    ];

    /// <summary>Removes legacy demo rows for إدارة المفاتيح (E-440x / seeded GUIDs).</summary>
    public static async Task RemoveDemoPropertyKeyRecordsAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken = default)
    {
        var demoRows = await db.PropertyKeyRecords
            .Where(r =>
                DemoPropertyKeyIds.Contains(r.Id) ||
                r.PropertyId.StartsWith("E-440"))
            .ToListAsync(cancellationToken);

        if (demoRows.Count == 0) return;

        db.PropertyKeyRecords.RemoveRange(demoRows);
        await db.SaveChangesAsync(cancellationToken);
    }



    private static readonly HrStaffSeed[] HrStaffSeeds =

    [

        new(

            "sliman",

            "s.salhy@gmail.com",

            "user1234",

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

            "salam",

            "salam@ejadah.dev",

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

            "user1234",

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

        "user1234",

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



    private static readonly Dictionary<string, string> DistributionAssigneeIdsByEmail =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["feras@ejadah.dev"] = "gov-firas",
            ["valuation@ejadah.dev"] = "vc-mohammed-diab",
            ["abdullah.kathiri@ejadah.dev"] = "val-abdullah",
            ["ahmed@ejadah.dev"] = "fi-ahmed",
            ["abdullah.abdulmane@ejadah.dev"] = "fi-abdullah-abdulmane",
            ["survey.jeddah@ejadah.dev"] = "eo-jeddah",
        };

    private static readonly Dictionary<string, string[]> ReviewerCityCoverageByEmail =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["feras@ejadah.dev"] = ["الرياض", "الطائف"],
        };

    private static void ApplyReviewerCityCoverage(UserProfile profile, string email)
    {
        if (!ReviewerCityCoverageByEmail.TryGetValue(email.Trim(), out var cities))
            return;
        profile.ReviewerCityCoverageJson = JsonSerializer.Serialize(cities);
    }

    /// <summary>
    /// Applies <paramref name="password"/> through Identity's AddPasswordAsync.
    /// SeedDemoData is forbidden in Production; local seed passwords are intentionally
    /// simple, so validators are suspended only for this call.
    /// </summary>
    private static async Task EnsureSeedPasswordAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string password)
    {
        if (await userManager.CheckPasswordAsync(user, password))
            return;

        var validators = userManager.PasswordValidators.ToList();
        userManager.PasswordValidators.Clear();
        try
        {
            if (await userManager.HasPasswordAsync(user))
            {
                var remove = await userManager.RemovePasswordAsync(user);
                if (!remove.Succeeded)
                {
                    throw new InvalidOperationException(
                        "Failed to clear password for " + (user.Email ?? user.UserName) + ": "
                        + string.Join("; ", remove.Errors.Select(e => e.Description)));
                }
            }

            var add = await userManager.AddPasswordAsync(user, password);
            if (!add.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to seed password for " + (user.Email ?? user.UserName) + ": "
                    + string.Join("; ", add.Errors.Select(e => e.Description)));
            }
        }
        finally
        {
            foreach (var validator in validators)
                userManager.PasswordValidators.Add(validator);
        }
    }

    private static async Task BackfillReviewerCityCoverageAsync(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        CancellationToken cancellationToken)
    {
        foreach (var (email, cities) in ReviewerCityCoverageByEmail)
        {
            var user = await userManager.FindByEmailAsync(email.Trim());
            if (user is null) continue;

            var profile = await db.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
            if (profile is null || !string.IsNullOrWhiteSpace(profile.ReviewerCityCoverageJson))
                continue;

            profile.ReviewerCityCoverageJson = JsonSerializer.Serialize(cities);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task BackfillDistributionAssigneeIdsAsync(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        CancellationToken cancellationToken)
    {
        foreach (var (email, assigneeId) in DistributionAssigneeIdsByEmail)
        {
            var user = await userManager.FindByEmailAsync(email.Trim());
            if (user is null) continue;

            var profile = await db.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
            if (profile is null) continue;

            if (string.Equals(
                    profile.DistributionAssigneeId,
                    assigneeId,
                    StringComparison.Ordinal))
                continue;

            profile.DistributionAssigneeId = assigneeId;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Align party child task <c>AssigneeId</c> with parent distribution (fixes empty/stale ids).
    /// </summary>
    private static async Task BackfillPartyChildAssigneeIdsAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var parentIds = await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (parentIds.Count == 0) return;

        var changed = false;
        var now = DateTime.UtcNow;

        foreach (var parentId in parentIds)
        {
            WorkflowTask? parent;
            try
            {
                parent = await db.WorkflowTasks
                    .AsTracking()
                    .FirstOrDefaultAsync(t => t.Id == parentId, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "BackfillPartyChildAssigneeIds: failed to load parent {ParentId}.",
                    parentId);
                continue;
            }

            if (parent is null || string.IsNullOrWhiteSpace(parent.DistributionJson))
                continue;

            var distribution = WorkflowTaskMapper.DeserializeDistribution(parent.DistributionJson);
            if (distribution is null) continue;

            List<WorkflowTask> children;
            try
            {
                children = await db.WorkflowTasks
                    .AsTracking()
                    .Where(t => t.ParentTaskId == parentId)
                    .ToListAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "BackfillPartyChildAssigneeIds: failed to load children for parent {ParentId}.",
                    parentId);
                continue;
            }
            foreach (var child in children)
            {
                var expectedId = PartyAssigneeIdFromDistribution(child.Kind, distribution);
                if (string.IsNullOrWhiteSpace(expectedId)) continue;

                var trimmed = expectedId.Trim();
                if (string.Equals(child.AssigneeId, trimmed, StringComparison.Ordinal))
                    continue;

                child.Assign(trimmed, child.AssigneeName, child.AssigneeRole, now);
                changed = true;
            }
        }

        if (changed)
            await db.SaveChangesAsync(cancellationToken);
    }

    private static string? PartyAssigneeIdFromDistribution(
        WorkflowTaskKind kind,
        TaskDistributionDraftDto distribution)
    {
        return kind switch
        {
            WorkflowTaskKind.GovernmentReview => distribution.GovernmentAuditorId,
            WorkflowTaskKind.FieldInspection => distribution.InspectorId,
            WorkflowTaskKind.PropertyAppraisal => distribution.ValuatorId,
            WorkflowTaskKind.ValuationCoordination => distribution.OperationsCoordinatorId,
            WorkflowTaskKind.EngineeringSurvey => distribution.EngineeringOfficeId,
            _ => null,
        };
    }



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



            var createResult = await userManager.CreateAsync(user);

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

        await EnsureSeedPasswordAsync(userManager, user, seed.Password);



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

                DistributionAssigneeId = DistributionAssigneeIdsByEmail.GetValueOrDefault(normalizedEmail),

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

            ApplyReviewerCityCoverage(profile, normalizedEmail);
            db.UserProfiles.Add(profile);

        }

        else

        {

            profile.RegistrationSource = RegistrationSource.Hr;

            profile.ContractType = seed.ContractType;

            profile.JobTitle = seed.JobTitle;

            profile.DistributionAssigneeId =
                DistributionAssigneeIdsByEmail.GetValueOrDefault(normalizedEmail);

            ApplyReviewerCityCoverage(profile, normalizedEmail);

            profile.PermissionLevel = seed.PermissionLevel;

            profile.Status = UserStatus.Active;

            if (profile.ProcProvider is not null)
            {
                db.ProcServiceProviderProfiles.Remove(profile.ProcProvider);
                profile.ProcProvider = null;
            }

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



            var createResult = await userManager.CreateAsync(user);

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

        await EnsureSeedPasswordAsync(userManager, user, seed.Password);



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

                DistributionAssigneeId =
                    DistributionAssigneeIdsByEmail.GetValueOrDefault(normalizedEmail),

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

            profile.DistributionAssigneeId =
                DistributionAssigneeIdsByEmail.GetValueOrDefault(normalizedEmail);

            profile.Status = UserStatus.Active;

            if (profile.HrEmployee is not null)
            {
                db.HrEmployeeProfiles.Remove(profile.HrEmployee);
                profile.HrEmployee = null;
            }

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
        const string password = "user1234";

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                DisplayName = "سالم الغريب",
            };

            var result = await userManager.CreateAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to seed default user: "
                    + string.Join("; ", result.Errors.Select(e => e.Description)));
            }
        }

        await EnsureSeedPasswordAsync(userManager, user, password);

        var roles = await userManager.GetRolesAsync(user);
        if (!roles.Contains("Admin"))
            await userManager.AddToRoleAsync(user, "Admin");

    }

    private static async Task EnsurePrototypeModuleDataAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        await RemoveDemoPropertyKeyRecordsAsync(db, cancellationToken);

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
                ValuationRequest.Create(
                    Guid.Parse("b2000001-0000-4000-8000-000000000001"),
                    "VR-441",
                    "E-4401",
                    "مكة المكرمة",
                    "أرض",
                    "عبدالله الكثيري",
                    "2025-01-13",
                    now,
                    ValuationRequestStatus.Done),
                ValuationRequest.Create(
                    Guid.Parse("b2000001-0000-4000-8000-000000000002"),
                    "VR-442",
                    "E-4402",
                    "مكة المكرمة",
                    "شقة",
                    "محمد العساف",
                    "2025-01-14",
                    now),
                ValuationRequest.Create(
                    Guid.Parse("b2000001-0000-4000-8000-000000000003"),
                    "VR-443",
                    "E-4403",
                    "جدة",
                    "فيلا",
                    "عبدالله الكثيري",
                    "2025-01-12",
                    now,
                    ValuationRequestStatus.Done),
                ValuationRequest.Create(
                    Guid.Parse("b2000001-0000-4000-8000-000000000004"),
                    "VR-444",
                    "E-4405",
                    "الطائف",
                    "عمارة",
                    "محمد العساف",
                    "2025-01-14",
                    now));
        }

        if (!await db.FailureTypesCatalogConfigs.AnyAsync(cancellationToken))
        {
            db.FailureTypesCatalogConfigs.Add(new FailureTypesCatalogConfig
            {
                Id = FailureTypesCatalogSeed.SingletonId,
                CatalogJson = FailureTypesCatalogSeed.CatalogJson,
                UpdatedAtUtc = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static readonly Guid SeededFinancialReportConfigId =
        Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890");

    public static async Task RemoveSeededFinancialReportConfigAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken = default)
    {
        await db.FinancialReportConfigs
            .Where(x => x.Id == SeededFinancialReportConfigId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static readonly string[] RetiredOrgAdminUsernames =
        ["alaa", "ali", "shahd"];

    /// <summary>Drops retired HR/PROC/CRM admin demo accounts (alaa / ali / shahd).</summary>
    private static async Task RemoveRetiredOrgAdminUsersAsync(
        UserManager<ApplicationUser> userManager,
        CancellationToken cancellationToken)
    {
        foreach (var username in RetiredOrgAdminUsernames)
        {
            var user = await userManager.FindByNameAsync(username);
            if (user is null)
                continue;

            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to remove retired org admin " + username + ": "
                    + string.Join("; ", result.Errors.Select(e => e.Description)));
            }
        }
    }


}


