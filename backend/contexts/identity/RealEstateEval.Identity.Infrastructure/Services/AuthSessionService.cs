using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

public sealed class AuthSessionService(
    UserManager<ApplicationUser> userManager,
    IdentityDbContext db,
    IPermissionService permissions,
    IJwtTokenService jwtTokenService,
    IConfiguration configuration,
    TimeProvider? time = null) : IAuthSessionService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public const int DefaultRefreshTokenHours = 12;
    private const int MaxRefreshTokenHours = 24 * 30;
    private const int TokenBytes = 32;
    private const string RotatedReason = "rotated";

 /// <summary>Rotated and expired rows are kept this long for audit, then pruned.</summary>
    private static readonly TimeSpan RetainAfterExpiry = TimeSpan.FromDays(7);

 /// <summary>
 /// Browser tabs each keep their own copy of a session, so two of them can rotate
 /// the same token at nearly the same moment. Within this window a replay is
 /// treated as that benign race and simply gets its own sibling token; later
 /// replays are treated as theft and drop the session family.
 /// </summary>
    private static readonly TimeSpan RotationGrace = TimeSpan.FromSeconds(60);

    private async Task<LoginResponseDto?> IssueAsync(
        ApplicationUser user,
        CancellationToken cancellationToken = default)
    {
        if (!await IsActiveAsync(user.Id, cancellationToken))
            return null;

        return await IssueForSessionAsync(user, Guid.NewGuid(), cancellationToken);
    }

    public async Task<LoginResponseDto?> IssueForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? null
            : await IssueAsync(user, cancellationToken);
    }

    public async Task<LoginResponseDto?> IssueForUsernameAsync(
        string username,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
            return null;

        var user = await LoginUserResolver.FindAsync(
            userManager,
            username,
            cancellationToken);
        return user is null
            ? null
            : await IssueAsync(user, cancellationToken);
    }

    public async Task<LoginResponseDto?> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            return null;

        var hash = HashToken(refreshToken);
        var stored = await db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (stored is null)
            return null;

        var nowUtc = _time.UtcNow();
        if (stored.ExpiresAtUtc <= nowUtc)
            return null;

        if (stored.RevokedAtUtc is null)
        {
            stored.RevokedAtUtc = nowUtc;
            stored.RevokedReason = RotatedReason;
        }
        else if (stored.RevokedReason != RotatedReason)
        {
            return null;
        }
        else if (nowUtc - stored.RevokedAtUtc.Value > RotationGrace)
        {
            await RevokeSessionAsync(stored.SessionId, "reuse-detected", cancellationToken);
            return null;
        }

        var user = await userManager.FindByIdAsync(stored.UserId);
        if (user is null || !await IsActiveAsync(stored.UserId, cancellationToken))
        {
            await RevokeSessionAsync(stored.SessionId, "account-inactive", cancellationToken);
            return null;
        }

 // Family expiry is absolute: rotating does not extend the login window.
        return await IssueForSessionAsync(
            user,
            stored.SessionId,
            cancellationToken,
            stored.ExpiresAtUtc);
    }

    public async Task RevokeAsync(
        string refreshToken,
        string reason,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            return;

        var hash = HashToken(refreshToken);
        var stored = await db.RefreshTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (stored is null)
            return;

        await RevokeSessionAsync(stored.SessionId, reason, cancellationToken);
    }

    public async Task<int> RevokeAllForUserAsync(
        string userId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var nowUtc = _time.UtcNow();
        var active = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in active)
        {
            token.RevokedAtUtc = nowUtc;
            token.RevokedReason = Truncate(reason);
        }

        await db.SaveChangesAsync(cancellationToken);
        return active.Count;
    }

    private async Task<LoginResponseDto> IssueForSessionAsync(
        ApplicationUser user,
        Guid sessionId,
        CancellationToken cancellationToken,
        DateTime? sessionExpiresAtUtc = null)
    {
        var roles = await userManager.GetRolesAsync(user);
        var userPermissions = await permissions.GetForUserIdAsync(user.Id, cancellationToken);
        var (accessToken, accessExpiresAtUtc) = jwtTokenService.CreateToken(
            new TokenSubject(user.Id, user.Email ?? string.Empty, user.DisplayName),
            roles,
            userPermissions?.Capabilities ?? [],
            userPermissions?.PrototypeRole,
            userPermissions?.DistributionAssigneeId,
            userPermissions?.Pages,
            userPermissions?.Department);

        var nowUtc = _time.UtcNow();

 // Housekeeping goes first and commits on its own: it is best-effort (see
 // SaveHousekeepingAsync) and must never take the token below down with it.
 // Stamp last login on fresh session issue only — refresh rotation keeps the family window.
        if (sessionExpiresAtUtc is null)
        {
            var profile = await db.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
            if (profile is not null)
                profile.LastLoginAtUtc = nowUtc;
        }

        await PruneAsync(user.Id, nowUtc, cancellationToken);
        await SaveHousekeepingAsync(cancellationToken);

        var refreshToken = CreateTokenValue();
        var refreshExpiresAtUtc = sessionExpiresAtUtc ?? nowUtc.AddHours(RefreshTokenHours());
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            SessionId = sessionId,
            TokenHash = HashToken(refreshToken),
            CreatedAtUtc = nowUtc,
            ExpiresAtUtc = refreshExpiresAtUtc,
        });
        await db.SaveChangesAsync(cancellationToken);

        return new LoginResponseDto
        {
            Token = accessToken,
            ExpiresAtUtc = accessExpiresAtUtc,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAtUtc = refreshExpiresAtUtc,
            User = new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            },
        };
    }

 /// <summary>
 /// Two logins for one user at the same moment (two tabs, a test runner) touch the same rows
 /// beside their own new token: both stamp <see cref="UserProfile.LastLoginAtUtc"/> on the
 /// row-versioned profile and both prune the same stale tokens. Neither write is worth failing
 /// a login over — the other stamp also says "now" and the other prune already removed the row
 /// — so the side that loses the race drops the writes that lost and keeps the rest.
 /// </summary>
    private async Task SaveHousekeepingAsync(CancellationToken cancellationToken)
    {
 // Every pass detaches at least one of the pending entries, so the loop ends once nothing
 // is left to save; the cap only guards against a provider reporting an entry it does not
 // track.
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (DbUpdateConcurrencyException ex)
                when (attempt < MaxHousekeepingRetries && ex.Entries.All(IsHousekeeping))
            {
                foreach (var entry in ex.Entries)
                    entry.State = EntityState.Detached;
            }
        }
    }

    private const int MaxHousekeepingRetries = 16;

    private static bool IsHousekeeping(EntityEntry entry) => entry.Entity switch
    {
        UserProfile => entry.State == EntityState.Modified,
        RefreshToken => entry.State == EntityState.Deleted,
        _ => false,
    };

    private async Task RevokeSessionAsync(
        Guid sessionId,
        string reason,
        CancellationToken cancellationToken)
    {
        var nowUtc = _time.UtcNow();
        var family = await db.RefreshTokens
            .Where(t => t.SessionId == sessionId && t.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in family)
        {
            token.RevokedAtUtc = nowUtc;
            token.RevokedReason = Truncate(reason);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task PruneAsync(
        string userId,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var cutoff = nowUtc - RetainAfterExpiry;
        var stale = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.ExpiresAtUtc < cutoff)
            .ToListAsync(cancellationToken);
        if (stale.Count > 0)
            db.RefreshTokens.RemoveRange(stale);
    }

    private async Task<bool> IsActiveAsync(string userId, CancellationToken cancellationToken) =>
        await db.UserProfiles
            .AsNoTracking()
            .AnyAsync(
                profile => profile.UserId == userId && profile.Status == UserStatus.Active,
                cancellationToken);

    private int RefreshTokenHours() => Math.Clamp(
        configuration.GetValue("Jwt:RefreshTokenHours", DefaultRefreshTokenHours),
        1,
        MaxRefreshTokenHours);

    private static string CreateTokenValue() =>
        Base64UrlEncode(RandomNumberGenerator.GetBytes(TokenBytes));

    private static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static string Truncate(string reason) =>
        reason.Length <= 128 ? reason : reason[..128];
}
