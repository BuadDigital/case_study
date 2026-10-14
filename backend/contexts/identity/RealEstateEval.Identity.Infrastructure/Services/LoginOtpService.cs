using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Domain;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;

namespace RealEstateEval.Identity.Infrastructure.Services;

/// <summary>
/// SMS login codes: issue, throttle, send, verify, then hand over to
/// <see cref="IAuthSessionService"/> for the session. Codes are stored hashed and die after
/// <see cref="LoginOtpRules.Lifetime"/>, one use, or <see cref="LoginOtpRules.MaxAttempts"/>
/// wrong guesses.
/// </summary>
public sealed class LoginOtpService(
    UserManager<ApplicationUser> userManager,
    IdentityDbContext db,
    ISmsSender sms,
    IAuthSessionService sessions,
    IConfiguration configuration,
    ILogger<LoginOtpService> logger,
    TimeProvider? time = null) : ILoginOtpService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<OtpRequestOutcome> RequestAsync(
        string mobile,
        CancellationToken cancellationToken = default)
    {
        var nowUtc = _time.UtcNow();
        var expiresIn = (int)LoginOtpRules.Lifetime.TotalSeconds;
        var cooldown = (int)LoginOtpRules.ResendCooldown.TotalSeconds;
        var normalized = SaudiMobiles.Normalize(mobile);
        if (normalized is null)
            return new OtpRequestOutcome(OtpRequestStatus.Sent, cooldown, expiresIn, sms.Channel);
        var delivery = DevLoginEnabled() && LoginOtpRules.IsSeededDemoMobile(normalized)
            ? SmsChannels.Dev
            : sms.Channel;

        var user = await userManager.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PhoneNumber == normalized, cancellationToken);
        if (user is null || !await IsActiveAsync(user.Id, cancellationToken))
        {
            // Same answer as a real send: the endpoint must not say which mobiles have accounts.
            return new OtpRequestOutcome(OtpRequestStatus.Sent, cooldown, expiresIn, delivery);
        }

        var windowStart = nowUtc - LoginOtpRules.RequestWindow;
        var recent = await db.LoginOtpCodes
            .Where(c => c.Mobile == normalized && c.CreatedAtUtc >= windowStart)
            .OrderBy(c => c.CreatedAtUtc)
            .Select(c => new { c.CreatedAtUtc, c.ExpiresAtUtc, c.ConsumedAtUtc, c.Attempts })
            .ToListAsync(cancellationToken);
        var lastLive = recent
            .Where(c => LoginOtpRules.IsLive(nowUtc, c.ExpiresAtUtc, c.ConsumedAtUtc, c.Attempts))
            .Select(c => (DateTime?)c.CreatedAtUtc)
            .LastOrDefault();
        var retryAfter = LoginOtpRules.RetryAfterSeconds(
            nowUtc,
            lastLive,
            recent.Select(c => c.CreatedAtUtc).ToList());
        if (retryAfter > 0)
            return new OtpRequestOutcome(OtpRequestStatus.Throttled, retryAfter, expiresIn, delivery);

        // One live code per mobile: the newest wins, older ones stop verifying.
        var open = await db.LoginOtpCodes
            .Where(c => c.Mobile == normalized && c.ConsumedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var old in open)
            old.ConsumedAtUtc = nowUtc;
        await PruneAsync(nowUtc, cancellationToken);

        var code = LoginOtpRules.NewCode();
        var demoBypass = DevLoginEnabled() && LoginOtpRules.IsSeededDemoMobile(normalized);
        var row = new LoginOtpCode
        {
            Mobile = normalized,
            UserId = user.Id,
            Channel = demoBypass ? SmsChannels.Dev : sms.Channel,
            CreatedAtUtc = nowUtc,
            ExpiresAtUtc = nowUtc + LoginOtpRules.Lifetime,
        };
        row.CodeHash = LoginOtpRules.Hash(row.Id, code);

        SmsSendResult sent;
        if (demoBypass)
        {
            logger.LogInformation("[dev-sms] demo account {Mobile}: code {Code}", normalized, code);
            sent = SmsSendResult.Ok();
        }
        else
        {
            sent = await sms.SendAsync(normalized, LoginOtpRules.MessageText(code), cancellationToken);
        }
        if (sent.Sent)
            db.LoginOtpCodes.Add(row);
        else
            logger.LogWarning("Login code for {Mobile} not sent: {Error}", normalized, sent.Error);
        await db.SaveChangesAsync(cancellationToken);
        if (!sent.Sent)
            return new OtpRequestOutcome(OtpRequestStatus.SendFailed, cooldown, expiresIn, delivery);
        return new OtpRequestOutcome(OtpRequestStatus.Sent, cooldown, expiresIn, delivery);
    }

    public async Task<OtpVerifyOutcome> VerifyAsync(
        string mobile,
        string code,
        CancellationToken cancellationToken = default)
    {
        var normalized = SaudiMobiles.Normalize(mobile);
        var trimmed = (code ?? string.Empty).Trim();
        if (normalized is null || !LoginOtpRules.IsWellFormed(trimmed))
            return OtpVerifyOutcome.Invalid();

        var nowUtc = _time.UtcNow();
        var row = await db.LoginOtpCodes
            .Where(c => c.Mobile == normalized && c.ConsumedAtUtc == null)
            .OrderByDescending(c => c.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null || !LoginOtpRules.IsLive(nowUtc, row.ExpiresAtUtc, row.ConsumedAtUtc, row.Attempts))
            return OtpVerifyOutcome.Invalid();

        // A stack without an SMS provider accepts any well-formed code (the real one is in the
        // log) so the team and the browser tests keep working; a configured provider is strict.
        var matches = row.CodeHash == LoginOtpRules.Hash(row.Id, trimmed)
            || (row.Channel == SmsChannels.Dev && DevLoginEnabled());
        if (!matches)
        {
            row.Attempts += 1;
            await db.SaveChangesAsync(cancellationToken);
            return OtpVerifyOutcome.Invalid();
        }

        row.ConsumedAtUtc = nowUtc;
        await db.SaveChangesAsync(cancellationToken);

        var session = await sessions.IssueForUserIdAsync(row.UserId, cancellationToken);
        return session is null
            ? OtpVerifyOutcome.Invalid()
            : new OtpVerifyOutcome(OtpVerifyStatus.Ok, session);
    }

    private bool DevLoginEnabled() => configuration.GetValue("Auth:EnableDevLogin", false);

    private async Task<bool> IsActiveAsync(string userId, CancellationToken cancellationToken) =>
        await db.UserProfiles
            .AsNoTracking()
            .AnyAsync(p => p.UserId == userId && p.Status == UserStatus.Active, cancellationToken);

    private async Task PruneAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var cutoff = nowUtc - LoginOtpRules.RetainAfterExpiry;
        var dead = await db.LoginOtpCodes
            .Where(c => c.ExpiresAtUtc < cutoff)
            .ToListAsync(cancellationToken);
        if (dead.Count > 0)
            db.LoginOtpCodes.RemoveRange(dead);
    }
}
