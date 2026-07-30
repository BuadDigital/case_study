using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class AuthSessionServiceTests
{
    [Fact]
    public async Task Login_issues_access_and_refresh_tokens()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);

        var login = await LoginAsync(provider);

        Assert.NotNull(login);
        Assert.False(string.IsNullOrWhiteSpace(login.Token));
        Assert.False(string.IsNullOrWhiteSpace(login.RefreshToken));
        Assert.True(login.ExpiresAtUtc > DateTime.UtcNow);
        Assert.True(login.RefreshTokenExpiresAtUtc > login.ExpiresAtUtc);
    }

    [Fact]
    public async Task Development_login_resolves_username_inside_session_service()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();

        var login = await sessions.IssueForUsernameAsync("test-user");

        Assert.NotNull(login);
        Assert.Equal("test-user", login.User.Email.Split('@')[0]);
        Assert.Null(await sessions.IssueForUsernameAsync("missing-user"));
    }

    [Fact]
    public async Task Refresh_rotates_the_token_and_keeps_the_session_window_fixed()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var login = await LoginAsync(provider);

        var refreshed = await sessions.RefreshAsync(login.RefreshToken);

        Assert.NotNull(refreshed);
        Assert.NotEqual(login.RefreshToken, refreshed.RefreshToken);
        Assert.Equal(login.RefreshTokenExpiresAtUtc, refreshed.RefreshTokenExpiresAtUtc);
    }

    [Fact]
    public async Task Refresh_tolerates_a_concurrent_second_use_of_the_same_token()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var login = await LoginAsync(provider);

        var first = await sessions.RefreshAsync(login.RefreshToken);
        var second = await sessions.RefreshAsync(login.RefreshToken);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
    }

    [Fact]
    public async Task Refresh_kills_the_session_when_a_rotated_token_is_replayed_later()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var db = provider.GetRequiredService<IdentityDbContext>();
        var login = await LoginAsync(provider);

        var refreshed = await sessions.RefreshAsync(login.RefreshToken);
        Assert.NotNull(refreshed);
        await AgeRotationsAsync(db, TimeSpan.FromMinutes(5));

        var replayed = await sessions.RefreshAsync(login.RefreshToken);

        Assert.Null(replayed);
        Assert.Null(await sessions.RefreshAsync(refreshed.RefreshToken));
    }

    [Fact]
    public async Task Refresh_is_rejected_after_logout()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var login = await LoginAsync(provider);

        await sessions.RevokeAsync(login.RefreshToken, "logout");

        Assert.Null(await sessions.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task Refresh_is_rejected_once_the_account_is_deactivated()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var db = provider.GetRequiredService<IdentityDbContext>();
        var login = await LoginAsync(provider);

        var profile = await db.UserProfiles.FirstAsync();
        profile.Status = UserStatus.Inactive;
        await db.SaveChangesAsync();

        Assert.Null(await sessions.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task Revoking_all_sessions_stops_further_refreshes()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var login = await LoginAsync(provider);
        var db = provider.GetRequiredService<IdentityDbContext>();
        var userId = (await db.UserProfiles.FirstAsync()).UserId;

        var revoked = await sessions.RevokeAllForUserAsync(userId, "roles-changed");

        Assert.Equal(1, revoked);
        Assert.Null(await sessions.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task Refresh_rejects_unknown_tokens()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var sessions = provider.GetRequiredService<IAuthSessionService>();

        Assert.Null(await sessions.RefreshAsync("not-a-real-token"));
        Assert.Null(await sessions.RefreshAsync(string.Empty));
    }

    [Fact]
    public async Task Stored_refresh_tokens_are_hashed()
    {
        await using var provider = await CreateProviderAsync(UserStatus.Active);
        var db = provider.GetRequiredService<IdentityDbContext>();
        var login = await LoginAsync(provider);

        var stored = await db.RefreshTokens.AsNoTracking().SingleAsync();

        Assert.NotEqual(login.RefreshToken, stored.TokenHash);
        Assert.Equal(64, stored.TokenHash.Length);
    }

    private static async Task<Contracts.LoginResponse> LoginAsync(IServiceProvider provider)
    {
        var sessions = provider.GetRequiredService<IAuthSessionService>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByNameAsync("test-user");
        Assert.NotNull(user);

        var login = await sessions.IssueForUserIdAsync(user.Id);
        Assert.NotNull(login);
        return login;
    }

    /// <summary>Backdates rotations so the concurrent-refresh grace window has passed.</summary>
    private static async Task AgeRotationsAsync(IdentityDbContext db, TimeSpan age)
    {
        var rotated = await db.RefreshTokens
            .Where(token => token.RevokedAtUtc != null)
            .ToListAsync();
        foreach (var token in rotated)
            token.RevokedAtUtc = token.RevokedAtUtc!.Value - age;
        await db.SaveChangesAsync();
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
        var databaseName = $"auth-session-{Guid.NewGuid()}";
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        services.AddDbContext<IdentityDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        services.AddIdentityApplicationServices();

        var provider = services.BuildServiceProvider();
        var identity = provider.GetRequiredService<IdentityDbContext>();
        await identity.Database.EnsureCreatedAsync();

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

        identity.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            User = user,
            RegistrationSource = RegistrationSource.Hr,
            ContractType = ContractType.Internal,
            JobTitle = "Tester",
            Status = status,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await identity.SaveChangesAsync();

        return provider;
    }
}
