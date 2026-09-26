using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.DbMigrate;

/// <summary>
/// Undoes what earlier production deploys left behind while they still ran the demo
/// seeder (audit A-005). Idempotent — the deploy runs it after every migrate:
/// <list type="bullet">
/// <item>deactivates the 14 fake comparable sales of the demo bank, so they can no longer be
/// found or adopted (rows stay: a valuation may already reference them);</item>
/// <item>disables the legacy <c>admin@local.dev</c> account and revokes its sessions;</item>
/// <item>reports, without changing them, valuations that adopted a demo comparable and
/// accounts still carrying a seeded demo mobile (+9665000000xx) — those need a person.</item>
/// </list>
/// </summary>
public static class DemoDataRetirement
{
    public const string LegacyAdminEmail = "admin@local.dev";
    private const string DemoMobilePrefix = "+9665000000";

    public static async Task RunAsync(
        ValuationDbContext valuation,
        IdentityDbContext identity,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var demoIds = DemoComparableBank.Ids;

        var activeDemo = await valuation.ComparableProperties
            .Where(c => demoIds.Contains(c.Id) && c.IsActive)
            .ToListAsync(cancellationToken);
        foreach (var comparable in activeDemo)
        {
            comparable.IsActive = false;
            comparable.UpdatedAtUtc = now;
        }
        await valuation.SaveChangesAsync(cancellationToken);
        Console.WriteLine(
            $"[retire-demo] demo comparables deactivated: {activeDemo.Count} (of {demoIds.Length} demo ids).");

        var adoptedIn = await valuation.ValuationComparableSelections
            .Where(s => demoIds.Contains(s.ComparablePropertyId) && s.SelectedByUserId != null)
            .Select(s => s.ValuationRequestId)
            .Distinct()
            .ToListAsync(cancellationToken);
        Console.WriteLine(adoptedIn.Count == 0
            ? "[retire-demo] no valuation adopted a demo comparable."
            : $"[retire-demo] REVIEW: {adoptedIn.Count} valuation request(s) adopted a demo comparable: {string.Join(", ", adoptedIn)}");

        var admin = await identity.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == LegacyAdminEmail.ToUpperInvariant(), cancellationToken);
        if (admin is null)
        {
            Console.WriteLine($"[retire-demo] {LegacyAdminEmail} not present.");
        }
        else
        {
            admin.LockoutEnabled = true;
            admin.LockoutEnd = DateTimeOffset.MaxValue;
            var profile = await identity.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == admin.Id, cancellationToken);
            if (profile is not null && profile.Status != UserStatus.Disabled)
            {
                profile.Status = UserStatus.Disabled;
                profile.UpdatedAtUtc = now;
            }
            var sessions = await identity.RefreshTokens
                .Where(t => t.UserId == admin.Id && t.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);
            foreach (var token in sessions)
            {
                token.RevokedAtUtc = now;
                token.RevokedReason = "demo-account-retired";
            }
            await identity.SaveChangesAsync(cancellationToken);
            Console.WriteLine(
                $"[retire-demo] {LegacyAdminEmail} disabled; {sessions.Count} active session(s) revoked.");
        }

        var demoMobiles = await identity.Users
            .Where(u => u.PhoneNumber != null && u.PhoneNumber.StartsWith(DemoMobilePrefix))
            .Join(
                identity.UserProfiles,
                u => u.Id,
                p => p.UserId,
                (u, p) => new { u.UserName, p.Status, p.LastLoginAtUtc })
            .OrderBy(x => x.UserName)
            .ToListAsync(cancellationToken);
        var stillActive = demoMobiles.Where(x => x.Status == UserStatus.Active).ToList();
        Console.WriteLine(stillActive.Count == 0
            ? "[retire-demo] no active account carries a seeded demo mobile."
            : $"[retire-demo] REVIEW: {stillActive.Count} active account(s) still carry a seeded demo mobile (give them the real number, or disable them): "
              + string.Join(", ", stillActive.Select(x =>
                  $"{x.UserName} (last login {x.LastLoginAtUtc?.ToString("yyyy-MM-dd") ?? "never"})")));
    }
}
