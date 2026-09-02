using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Domain;
using RealEstateEval.Identity.Infrastructure;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// PATCH is the only write path an administrator has over an existing account, so these tests
/// pin partial-update semantics, the uniqueness guards and the audit trail each edit leaves.
/// </summary>
public class StaffUserUpdateTests
{
    private static CreateStaffUserRequest SampleRequest(
        string email = "New.Staff@example.test",
        string mobile = "0500000099",
        string nationalId = "1000000091") => new()
        {
            DisplayName = "موظف تجريبي",
            Email = email,
            Mobile = mobile,
            City = "الرياض",
            NationalId = nationalId,
            RoleId = "case-specialist",
        };

    [Fact]
    public async Task Update_touches_only_the_members_present_in_the_request()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (updated, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { City = "جدة" },
            "admin");

        Assert.Null(errors);
        Assert.NotNull(updated);
        Assert.Equal("جدة", updated.City);
        Assert.Equal("موظف تجريبي", updated.DisplayName);
        Assert.Equal("+966500000099", updated.Mobile);
        Assert.Equal("case-specialist", updated.RoleId);

        var db = provider.GetRequiredService<IdentityDbContext>();
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_UPDATED");
        Assert.Equal("admin", audit.ActorId);
        Assert.Equal("user", audit.EntityType);
        Assert.Equal(created.User.Id, audit.EntityId);
        Assert.Equal(
            "الرياض",
            JsonDocument.Parse(audit.BeforeJson).RootElement.GetProperty("city").GetString());
        Assert.Equal(
            "جدة",
            JsonDocument.Parse(audit.AfterJson).RootElement.GetProperty("city").GetString());
        Assert.False(
            JsonDocument.Parse(audit.AfterJson).RootElement.TryGetProperty("email", out _));
    }

    [Fact]
    public async Task Update_without_any_effective_change_writes_no_audit_entry()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (_, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { City = "الرياض" },
            "admin");

        Assert.Null(errors);
        var db = provider.GetRequiredService<IdentityDbContext>();
        Assert.DoesNotContain(db.AuditLogs, entry => entry.Action == "USER_UPDATED");
    }

    [Fact]
    public async Task Update_rejects_a_mobile_that_belongs_to_another_account()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (first, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await users.CreateStaffAsync(
            SampleRequest("Other.Staff@example.test", "0500000077", "1000000092"),
            "admin");

        var (result, errors) = await users.UpdateStaffAsync(
            first!.User.Id,
            new UpdateStaffUserRequest { Mobile = "0500000077" },
            "admin");

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Equal("رقم الجوال مستخدم مسبقاً.", errors["mobile"]);
    }

    [Fact]
    public async Task Update_rejects_a_national_id_that_belongs_to_another_account()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (first, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await users.CreateStaffAsync(
            SampleRequest("Other.Staff@example.test", "0500000077", "1000000092"),
            "admin");

        var (_, errors) = await users.UpdateStaffAsync(
            first!.User.Id,
            new UpdateStaffUserRequest { NationalId = "1000000092" },
            "admin");

        Assert.NotNull(errors);
        Assert.True(errors.ContainsKey("nationalId"));
    }

    [Fact]
    public async Task Changing_the_mobile_clears_its_confirmation_flag()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (_, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { Mobile = "0512345678" },
            "admin");

        Assert.Null(errors);
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(created.User.Id);
        Assert.Equal("+966512345678", user!.PhoneNumber);
        Assert.False(user.PhoneNumberConfirmed);
    }

    [Fact]
    public async Task Changing_the_role_rederives_the_job_title_and_identity_roles()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (updated, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest
            {
                RoleId = "section-supervisor",
                Department = SupervisingDepartments.CaseStudy,
            },
            "admin");

        Assert.Null(errors);
        Assert.Equal("section-supervisor", updated!.RoleId);
        Assert.Equal(SupervisingDepartments.CaseStudy, updated.Department);
        Assert.NotEqual(created.User.JobTitle, updated.JobTitle);

        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(created.User.Id);
        var roles = await userManager.GetRolesAsync(user!);
        Assert.Contains("Supervisor", roles);
        Assert.DoesNotContain("Editor", roles);
    }

    [Fact]
    public async Task Creating_a_section_supervisor_requires_a_selectable_department()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var request = SampleRequest();
        request = new CreateStaffUserRequest
        {
            DisplayName = request.DisplayName,
            Email = request.Email,
            Mobile = request.Mobile,
            City = request.City,
            NationalId = request.NationalId,
            RoleId = "section-supervisor",
        };

        var (created, errors) = await users.CreateStaffAsync(request, "admin");
        Assert.Null(created);
        Assert.NotNull(errors);
        Assert.True(errors.ContainsKey("department"));
    }

    [Fact]
    public async Task Creating_a_section_supervisor_persists_the_canonical_department()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var request = SampleRequest();
        var (created, errors) = await users.CreateStaffAsync(
            new CreateStaffUserRequest
            {
                DisplayName = request.DisplayName,
                Email = request.Email,
                Mobile = request.Mobile,
                City = request.City,
                NationalId = request.NationalId,
                RoleId = "section-supervisor",
                Department = SupervisingDepartments.Valuation,
            },
            "admin");

        Assert.Null(errors);
        Assert.Equal(SupervisingDepartments.Valuation, created!.User.Department);
    }

    [Fact]
    public async Task Non_supervisor_roles_ignore_requested_department_overrides()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var request = SampleRequest();
        var (created, errors) = await users.CreateStaffAsync(
            new CreateStaffUserRequest
            {
                DisplayName = request.DisplayName,
                Email = request.Email,
                Mobile = request.Mobile,
                City = request.City,
                NationalId = request.NationalId,
                RoleId = "case-specialist",
                Department = SupervisingDepartments.Valuation,
            },
            "admin");

        Assert.Null(errors);
        Assert.Equal(SupervisingDepartments.CaseStudy, created!.User.Department);
    }

    [Fact]
    public async Task Changing_the_role_preserves_the_distribution_assignee_id()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        var db = provider.GetRequiredService<IdentityDbContext>();
        var before = (await db.UserProfiles
            .SingleAsync(profile => profile.UserId == created!.User.Id)).DistributionAssigneeId;

        await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest
            {
                RoleId = "section-supervisor",
                Department = SupervisingDepartments.CaseStudy,
            },
            "admin");

        var after = (await db.UserProfiles
            .SingleAsync(profile => profile.UserId == created.User.Id)).DistributionAssigneeId;
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Switching_away_from_field_inspector_clears_the_inspector_type()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var request = SampleRequest();
        var (created, createErrors) = await users.CreateStaffAsync(
            new CreateStaffUserRequest
            {
                DisplayName = request.DisplayName,
                Email = request.Email,
                Mobile = request.Mobile,
                City = request.City,
                NationalId = request.NationalId,
                RoleId = "field-inspector",
                InspectorType = "contractor",
            },
            "admin");

        Assert.Null(createErrors);

        var (updated, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { RoleId = "case-specialist" },
            "admin");

        Assert.Null(errors);
        Assert.Null(updated!.InspectorType);
    }

    [Fact]
    public async Task Field_inspector_requires_an_inspector_type()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (_, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { RoleId = "field-inspector" },
            "admin");

        Assert.NotNull(errors);
        Assert.True(errors.ContainsKey("inspectorType"));
    }

    [Fact]
    public async Task Disabling_through_patch_revokes_sessions_and_records_the_transition()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        var db = provider.GetRequiredService<IdentityDbContext>();
        await ActivateAsync(provider, users, created!);
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = created!.User.Id,
            TokenHash = "hash",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(1),
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var (updated, errors) = await users.UpdateStaffAsync(
            created.User.Id,
            new UpdateStaffUserRequest { Status = UserStatus.Disabled },
            "different-admin");

        Assert.Null(errors);
        Assert.Equal(UserStatus.Disabled, updated!.Status);
        Assert.All(
            await db.RefreshTokens.Where(token => token.UserId == created.User.Id).ToListAsync(),
            token => Assert.NotNull(token.RevokedAtUtc));
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_DISABLED");
        Assert.Equal("different-admin", audit.ActorId);
    }

    [Fact]
    public async Task An_administrator_cannot_disable_their_own_account()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await ActivateAsync(provider, users, created!);

        var (result, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { Status = UserStatus.Disabled },
            created.User.Id);

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Equal("لا يمكنك تعطيل حسابك الحالي.", errors["_form"]);
    }

    [Fact]
    public async Task Reactivating_a_disabled_account_clears_the_lockout()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await ActivateAsync(provider, users, created!);
        await users.DeleteStaffAsync(created!.User.Id, "admin");

        var (updated, errors) = await users.UpdateStaffAsync(
            created.User.Id,
            new UpdateStaffUserRequest { Status = UserStatus.Active },
            "admin");

        Assert.Null(errors);
        Assert.Equal(UserStatus.Active, updated!.Status);
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.False(await userManager.IsLockedOutAsync(
            (await userManager.FindByIdAsync(created.User.Id))!));
        var db = provider.GetRequiredService<IdentityDbContext>();
        Assert.Contains(db.AuditLogs, entry => entry.Action == "USER_REACTIVATED");
    }

    [Fact]
    public async Task A_pending_account_cannot_be_forced_active_without_an_activation_ticket()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");

        var (result, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { Status = UserStatus.Active },
            "admin");

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.True(errors.ContainsKey("status"));
    }

    [Fact]
    public async Task An_iban_change_is_audited_by_presence_and_never_by_value()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        const string iban = "SA4420000001234567891234";

        var (_, errors) = await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { Iban = iban },
            "admin");

        Assert.Null(errors);
        var db = provider.GetRequiredService<IdentityDbContext>();
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_UPDATED");
        Assert.DoesNotContain(iban, audit.AfterJson, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(
            "set",
            JsonDocument.Parse(audit.AfterJson).RootElement.GetProperty("iban").GetString());
        Assert.Equal(
            iban,
            (await db.UserProfiles.SingleAsync(p => p.UserId == created.User.Id)).Iban);
    }

    [Fact]
    public async Task An_empty_string_clears_an_optional_field()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await users.UpdateStaffAsync(
            created!.User.Id,
            new UpdateStaffUserRequest { TaxNumber = "300000000000003" },
            "admin");

        var (updated, errors) = await users.UpdateStaffAsync(
            created.User.Id,
            new UpdateStaffUserRequest { TaxNumber = "" },
            "admin");

        Assert.Null(errors);
        Assert.Null(updated!.TaxNumber);
    }

    [Fact]
    public async Task Unlock_clears_the_lockout_and_records_an_audit_entry()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await ActivateAsync(provider, users, created!);
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(created!.User.Id);
        await userManager.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddHours(1));

        var (ok, error) = await users.UnlockStaffAsync(created.User.Id, "admin");

        Assert.True(ok, error);
        Assert.False(await userManager.IsLockedOutAsync(
            (await userManager.FindByIdAsync(created.User.Id))!));
        var db = provider.GetRequiredService<IdentityDbContext>();
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_UNLOCKED");
        Assert.Equal("admin", audit.ActorId);
    }

    [Fact]
    public async Task Unlock_refuses_a_disabled_account()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest(), "admin");
        await ActivateAsync(provider, users, created!);
        await users.DeleteStaffAsync(created!.User.Id, "admin");

        var (ok, error) = await users.UnlockStaffAsync(created.User.Id, "admin");

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Update_reports_an_unknown_user_without_touching_anything()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (result, errors) = await users.UpdateStaffAsync(
            Guid.NewGuid().ToString(),
            new UpdateStaffUserRequest { City = "جدة" },
            "admin");

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.True(errors.ContainsKey("_form"));
    }

    private static async Task ActivateAsync(
        ServiceProvider provider,
        IUserRegistrationService users,
        CreateStaffUserResponseDto created)
    {
        var (ticket, _) = await users.IssueActivationTicketAsync(created.User.Id, "admin");
        await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = ticket!.UserName,
            Token = ticket.Token,
            NewPassword = "ChosenByHolder1!",
        });
    }

    private static async Task<ServiceProvider> CreateProviderAsync()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "RealEstateEval.Tests",
                ["Jwt:Audience"] = "RealEstateEval.Tests",
                ["Jwt:SigningKey"] =
                    "test-signing-key-that-is-longer-than-sixty-four-characters-1234567890",
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddSingleton<IConfiguration>(configuration);
        var databaseName = $"staff-update-{Guid.NewGuid()}";
        services.AddDbContext<IdentityDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        services.AddIdentityApplicationServices();

        var provider = services.BuildServiceProvider();
        await provider.GetRequiredService<IdentityDbContext>().Database.EnsureCreatedAsync();

        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[]
                 {
                     DepartmentRoles.Proc,
                     OrgRoles.Cdo,
                     "Editor",
                     "Supervisor",
                 })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        return provider;
    }
}
