using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class PasswordAuthenticationServiceTests
{
    [Fact]
    public async Task Authenticate_returns_token_for_active_user_with_valid_password()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var service = provider.GetRequiredService<IPasswordAuthenticationService>();

        var result = await service.AuthenticateAsync("test-user", "StrongPass123!");

        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result.Token));
        Assert.Equal("test-user@example.test", result.User.Email);
    }

    [Fact]
    public async Task Authenticate_accepts_email_with_valid_password()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var service = provider.GetRequiredService<IPasswordAuthenticationService>();

        var result = await service.AuthenticateAsync(
            "TEST-USER@EXAMPLE.TEST",
            "StrongPass123!");

        Assert.NotNull(result);
        Assert.Equal("test-user@example.test", result.User.Email);
    }

    [Fact]
    public async Task Authenticate_rejects_wrong_password_and_tracks_failure()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var service = provider.GetRequiredService<IPasswordAuthenticationService>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();

        var result = await service.AuthenticateAsync("test-user", "wrong-password");
        var user = await userManager.FindByNameAsync("test-user");

        Assert.Null(result);
        Assert.Equal(1, user?.AccessFailedCount);
    }

    [Fact]
    public async Task Authenticate_rejects_inactive_user()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Inactive);
        var service = provider.GetRequiredService<IPasswordAuthenticationService>();

        var result = await service.AuthenticateAsync("test-user", "StrongPass123!");

        Assert.Null(result);
    }

    [Fact]
    public async Task Authenticate_locks_account_after_five_failed_attempts()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var service = provider.GetRequiredService<IPasswordAuthenticationService>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();

        for (var attempt = 0; attempt < 5; attempt++)
            await service.AuthenticateAsync("test-user", "wrong-password");

        var user = await userManager.FindByNameAsync("test-user");
        Assert.NotNull(user);
        Assert.True(await userManager.IsLockedOutAsync(user));
    }

    private static async Task<ServiceProvider> CreateProviderAsync(UserStatus status)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "RealEstateEval.Tests",
                ["Jwt:Audience"] = "RealEstateEval.Tests",
                ["Jwt:SigningKey"] = "test-signing-key-that-is-longer-than-sixty-four-characters-1234567890",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase($"password-auth-{Guid.NewGuid()}"));
        services.AddIdentityInfrastructure();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<ApplicationDbContext>();
        await db.Database.EnsureCreatedAsync();

        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser
        {
            UserName = "test-user",
            Email = "test-user@example.test",
            EmailConfirmed = true,
            DisplayName = "Test User",
        };
        var creation = await userManager.CreateAsync(user, "StrongPass123!");
        Assert.True(
            creation.Succeeded,
            string.Join("; ", creation.Errors.Select(error => error.Description)));

        db.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            User = user,
            RegistrationSource = RegistrationSource.Hr,
            ContractType = ContractType.Internal,
            JobTitle = "Tester",
            Status = status,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        return provider;
    }
}
