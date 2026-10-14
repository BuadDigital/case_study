using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Infrastructure;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

/// <summary>SMS login: request → text → verify → session, with the throttles and dead ends.</summary>
public class LoginOtpServiceTests
{
    private const string Mobile = "+966512345678";
    private const string DemoMobile = "+966500000001";

    [Fact]
    public async Task Request_texts_a_code_and_verify_opens_a_session()
    {
        await using var provider = await CreateProviderAsync();
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();

        var requested = await otp.RequestAsync("0512345678");

        Assert.Equal(OtpRequestStatus.Sent, requested.Status);
        Assert.Equal(SmsChannels.Sms, requested.Delivery);
        var text = Assert.Single(sms.Sent);
        Assert.Equal(Mobile, text.Mobile);
        var code = ExtractCode(text.Text);

        var verified = await otp.VerifyAsync("512345678", code);

        Assert.Equal(OtpVerifyStatus.Ok, verified.Status);
        Assert.NotNull(verified.Session);
        Assert.Equal("Test User", verified.Session.User.DisplayName);
        // Consumed: the same code cannot open a second session.
        Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync(Mobile, code)).Status);
    }

    [Fact]
    public async Task Unknown_mobile_gets_the_same_answer_and_no_text()
    {
        await using var provider = await CreateProviderAsync();
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();

        var requested = await otp.RequestAsync("0599999999");

        Assert.Equal(OtpRequestStatus.Sent, requested.Status);
        Assert.Empty(sms.Sent);
        Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync("0599999999", "123456")).Status);
    }

    [Fact]
    public async Task A_second_request_inside_the_cooldown_is_throttled()
    {
        await using var provider = await CreateProviderAsync();
        var otp = provider.GetRequiredService<ILoginOtpService>();

        Assert.Equal(OtpRequestStatus.Sent, (await otp.RequestAsync(Mobile)).Status);
        var again = await otp.RequestAsync(Mobile);

        Assert.Equal(OtpRequestStatus.Throttled, again.Status);
        Assert.InRange(again.RetryAfterSeconds, 1, (int)LoginOtpRules.ResendCooldown.TotalSeconds);
    }

    [Fact]
    public async Task Wrong_guesses_kill_the_code_after_the_limit()
    {
        await using var provider = await CreateProviderAsync();
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();
        await otp.RequestAsync(Mobile);
        var code = ExtractCode(sms.Sent.Single().Text);

        for (var i = 0; i < LoginOtpRules.MaxAttempts; i++)
            Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync(Mobile, Wrong(code))).Status);

        Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync(Mobile, code)).Status);
    }

    [Fact]
    public async Task A_failed_text_stores_nothing()
    {
        await using var provider = await CreateProviderAsync(sendSucceeds: false);
        var otp = provider.GetRequiredService<ILoginOtpService>();

        var requested = await otp.RequestAsync(Mobile);

        Assert.Equal(OtpRequestStatus.SendFailed, requested.Status);
        var db = provider.GetRequiredService<IdentityDbContext>();
        Assert.Equal(0, await db.LoginOtpCodes.CountAsync());
    }

    [Fact]
    public async Task Without_a_provider_a_dev_login_host_accepts_any_code()
    {
        await using var provider = await CreateProviderAsync(channel: SmsChannels.Dev, devLogin: true);
        var otp = provider.GetRequiredService<ILoginOtpService>();
        await otp.RequestAsync(Mobile);

        Assert.Equal(OtpVerifyStatus.Ok, (await otp.VerifyAsync(Mobile, "123456")).Status);
    }

    [Fact]
    public async Task Seeded_demo_mobiles_skip_the_provider_on_a_dev_login_host()
    {
        await using var provider = await CreateProviderAsync(channel: SmsChannels.Sms, devLogin: true, mobile: DemoMobile);
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();

        var requested = await otp.RequestAsync(DemoMobile);

        Assert.Equal(OtpRequestStatus.Sent, requested.Status);
        Assert.Equal(SmsChannels.Dev, requested.Delivery);
        Assert.Empty(sms.Sent);
        Assert.Equal(OtpVerifyStatus.Ok, (await otp.VerifyAsync(DemoMobile, "111111")).Status);
    }

    [Fact]
    public async Task Seeded_demo_mobiles_are_real_users_when_dev_login_is_off()
    {
        await using var provider = await CreateProviderAsync(channel: SmsChannels.Sms, devLogin: false, mobile: DemoMobile);
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();

        var requested = await otp.RequestAsync(DemoMobile);

        Assert.Equal(SmsChannels.Sms, requested.Delivery);
        Assert.Single(sms.Sent);
        Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync(DemoMobile, "111111")).Status);
    }

    [Fact]
    public async Task A_real_provider_is_strict_even_on_a_dev_login_host()
    {
        await using var provider = await CreateProviderAsync(channel: SmsChannels.Sms, devLogin: true);
        var otp = provider.GetRequiredService<ILoginOtpService>();
        var sms = provider.GetRequiredService<RecordingSmsSender>();
        await otp.RequestAsync(Mobile);
        var code = ExtractCode(sms.Sent.Single().Text);

        Assert.Equal(OtpVerifyStatus.Invalid, (await otp.VerifyAsync(Mobile, Wrong(code))).Status);
        Assert.Equal(OtpVerifyStatus.Ok, (await otp.VerifyAsync(Mobile, code)).Status);
    }

    private static string ExtractCode(string text)
    {
        var digits = new string(text.Where(char.IsAsciiDigit).ToArray());
        return digits[..LoginOtpRules.CodeLength];
    }

    private static string Wrong(string code) =>
        (code[0] == '9' ? '0' : (char)(code[0] + 1)) + code[1..];

    private sealed class RecordingSmsSender(string channel, bool succeeds) : ISmsSender
    {
        public List<(string Mobile, string Text)> Sent { get; } = [];
        public string Channel => channel;

        public Task<SmsSendResult> SendAsync(string mobileE164, string text, CancellationToken cancellationToken = default)
        {
            if (!succeeds)
                return Task.FromResult(SmsSendResult.Failed("down"));
            Sent.Add((mobileE164, text));
            return Task.FromResult(SmsSendResult.Ok("m1"));
        }
    }

    private static async Task<ServiceProvider> CreateProviderAsync(
        string channel = SmsChannels.Sms,
        bool sendSucceeds = true,
        bool devLogin = false,
        string mobile = Mobile)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "RealEstateEval.Tests",
                ["Jwt:Audience"] = "RealEstateEval.Tests",
                ["Jwt:SigningKey"] = "test-signing-key-that-is-longer-than-sixty-four-characters-1234567890",
                ["Auth:EnableDevLogin"] = devLogin ? "true" : "false",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddDbContext<IdentityDbContext>(options =>
            options.UseInMemoryDatabase($"login-otp-{Guid.NewGuid()}"));
        var sender = new RecordingSmsSender(channel, sendSucceeds);
        services.AddSingleton(sender);
        services.AddSingleton<ISmsSender>(sender);
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
            PhoneNumber = mobile,
        };
        var creation = await userManager.CreateAsync(user, "StrongPass123!");
        Assert.True(creation.Succeeded, string.Join("; ", creation.Errors.Select(e => e.Description)));

        identity.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            User = user,
            RegistrationSource = RegistrationSource.Hr,
            ContractType = ContractType.Internal,
            JobTitle = "Tester",
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await identity.SaveChangesAsync();
        return provider;
    }
}
