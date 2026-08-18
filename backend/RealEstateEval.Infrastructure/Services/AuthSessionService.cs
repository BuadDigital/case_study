using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

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

        var user = await userManager.FindByNameAsync(username.Trim());
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

 // Stamp last login on fresh session issue only — refresh rotation keeps the family window.
        if (sessionExpiresAtUtc is null)
        {
            var profile = await db.UserProfiles
                .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
            if (profile is not null)
                profile.LastLoginAtUtc = nowUtc;
        }

        await PruneAsync(user.Id, nowUtc, cancellationToken);
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
