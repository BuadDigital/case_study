using System.Reflection;
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

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Staff creation must not hand out credentials. These tests pin the response contract
/// and the activation hand-off that replaced the old temporary-password flow.
/// </summary>
public class StaffAccountActivationTests
{
    private static readonly CreateStaffUserRequest SampleRequest = new()
    {
        DisplayName = "موظف تجريبي",
        Email = "New.Staff@example.test",
        Mobile = "0500000099",
        City = "الرياض",
        NationalId = "1000000091",
        RoleId = "case-specialist",
    };

    [Fact]
    public void Create_response_contract_exposes_no_secret_bearing_member()
    {
        var suspicious = typeof(CreateStaffUserResponseDto)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p =>
                p.Name.Contains("password", StringComparison.OrdinalIgnoreCase)
                || p.Name.Contains("secret", StringComparison.OrdinalIgnoreCase)
                || p.Name.Contains("credential", StringComparison.OrdinalIgnoreCase)
                || p.Name.Contains("token", StringComparison.OrdinalIgnoreCase))
            .Select(p => p.Name)
            .ToList();

        Assert.Empty(suspicious);
    }

    [Fact]
    public async Task Create_returns_no_password_anywhere_in_the_serialized_response()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (result, errors) = await users.CreateStaffAsync(SampleRequest, "admin");

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.True(result.ActivationRequired);
        Assert.Equal(UserStatus.PendingActivation, result.User.Status);
        Assert.Equal("case-specialist", result.User.RoleId);
        Assert.Equal("+966500000099", result.User.Mobile);
        var db = provider.GetRequiredService<IdentityDbContext>();
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_CREATED");
        Assert.Equal("admin", audit.ActorId);
        Assert.Equal(result.User.Id, audit.EntityId);

        var json = JsonSerializer.Serialize(result);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Tmp1!", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Created_account_has_no_password_hash_and_cannot_sign_in()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();

        var (result, _) = await users.CreateStaffAsync(SampleRequest, "admin");
        var user = await userManager.FindByNameAsync(result!.UserName);

        Assert.NotNull(user);
        Assert.False(await userManager.HasPasswordAsync(user));

        var auth = provider.GetRequiredService<IPasswordAuthenticationService>();
        Assert.Null(await auth.AuthenticateAsync(result.UserName, "AnythingAtAll123!"));
    }

    [Fact]
    public async Task Activation_ticket_lets_the_holder_set_a_password_and_sign_in()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (created, _) = await users.CreateStaffAsync(SampleRequest, "admin");
        var (ticket, ticketError) = await users.IssueActivationTicketAsync(
            created!.User.Id,
            "admin");

        Assert.Null(ticketError);
        Assert.NotNull(ticket);
        Assert.Equal(created.UserName, ticket.UserName);
        Assert.True(ticket.ExpiresAtUtc > DateTime.UtcNow);

        var (ok, error) = await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = ticket.UserName,
            Token = ticket.Token,
            NewPassword = "ChosenByHolder1!",
        });

        Assert.True(ok, error);

        var auth = provider.GetRequiredService<IPasswordAuthenticationService>();
        var session = await auth.AuthenticateAsync(created.UserName, "ChosenByHolder1!");
        Assert.NotNull(session);
        var db = provider.GetRequiredService<IdentityDbContext>();
        Assert.Equal(
            UserStatus.Active,
            (await db.UserProfiles.SingleAsync(profile => profile.UserId == created.User.Id)).Status);
        Assert.Contains(db.AuditLogs, audit => audit.Action == "USER_ACTIVATED");
    }

    [Fact]
    public async Task Activation_ticket_cannot_be_redeemed_twice()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (created, _) = await users.CreateStaffAsync(SampleRequest, "admin");
        var (ticket, _) = await users.IssueActivationTicketAsync(created!.User.Id, "admin");

        var first = await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = ticket!.UserName,
            Token = ticket.Token,
            NewPassword = "ChosenByHolder1!",
        });
        var second = await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = ticket.UserName,
            Token = ticket.Token,
            NewPassword = "SomethingElse2!",
        });

        Assert.True(first.Ok, first.Error);
        Assert.False(second.Ok);
    }

    [Fact]
    public async Task Activation_reports_the_same_error_for_unknown_users_and_bad_tickets()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (created, _) = await users.CreateStaffAsync(SampleRequest, "admin");
        var (_, unknownUserError) = await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = "nobody-here",
            Token = "irrelevant",
            NewPassword = "ChosenByHolder1!",
        });
        var (_, badTicketError) = await users.ActivateAccountAsync(new ActivateAccountRequest
        {
            UserName = created!.UserName,
            Token = "forged-ticket",
            NewPassword = "ChosenByHolder1!",
        });

        Assert.NotNull(unknownUserError);
        Assert.Equal(unknownUserError, badTicketError);
    }

    [Fact]
    public async Task Activation_ticket_is_refused_for_an_unknown_user_id()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (ticket, error) = await users.IssueActivationTicketAsync(
            Guid.NewGuid().ToString(),
            "admin");

        Assert.Null(ticket);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Disable_keeps_the_user_and_records_an_audit_entry()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();
        var (created, _) = await users.CreateStaffAsync(SampleRequest, "admin");

        var (ok, error) = await users.DeleteStaffAsync(
            created!.User.Id,
            "different-admin");

        Assert.True(ok, error);
        var db = provider.GetRequiredService<IdentityDbContext>();
        Assert.NotNull(await db.Users.FindAsync(created.User.Id));
        Assert.Equal(
            UserStatus.Disabled,
            (await db.UserProfiles.SingleAsync(profile => profile.UserId == created.User.Id)).Status);
        var audit = Assert.Single(db.AuditLogs, entry => entry.Action == "USER_DISABLED");
        Assert.Equal("different-admin", audit.ActorId);
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
        var databaseName = $"staff-activation-{Guid.NewGuid()}";
        services.AddDbContext<IdentityDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        services.AddIdentityApplicationServices();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<IdentityDbContext>();
        await db.Database.EnsureCreatedAsync();

        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { DepartmentRoles.Hr, "Editor", "Supervisor" })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        return provider;
    }
}
