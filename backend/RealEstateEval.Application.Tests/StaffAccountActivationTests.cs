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
using RealEstateEval.Infrastructure.Data;
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

        var (result, errors) = await users.CreateStaffAsync(SampleRequest);

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.True(result.ActivationRequired);

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

        var (result, _) = await users.CreateStaffAsync(SampleRequest);
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

        var (created, _) = await users.CreateStaffAsync(SampleRequest);
        var (ticket, ticketError) = await users.IssueActivationTicketAsync(created!.User.Id);

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
    }

    [Fact]
    public async Task Activation_ticket_cannot_be_redeemed_twice()
    {
        await using var provider = await CreateProviderAsync();
        var users = provider.GetRequiredService<IUserRegistrationService>();

        var (created, _) = await users.CreateStaffAsync(SampleRequest);
        var (ticket, _) = await users.IssueActivationTicketAsync(created!.User.Id);

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

        var (created, _) = await users.CreateStaffAsync(SampleRequest);
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

        var (ticket, error) = await users.IssueActivationTicketAsync(Guid.NewGuid().ToString());

        Assert.Null(ticket);
        Assert.NotNull(error);
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
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
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
