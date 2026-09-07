using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;
using RealEstateEval.Identity.Application.Rules;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Application.Services;

/// <summary>
/// Account lifecycle after registration: unlock, soft-disable (the delete endpoint and the
/// PATCH status transition share <see cref="ApplyStatusChangeAsync"/>'s semantics), and the
/// development-only bulk delete that spares the seeded administrator and organization seats.
/// </summary>
public partial class UserRegistrationService
{
    public async Task<int> DeleteAllRegisteredAsync(
        CancellationToken cancellationToken = default)
    {
        const string protectedEmail = "admin@local.dev";

        var userIds = await _repo.ListProfiledUserIdsAsync(cancellationToken);

        var deleted = 0;
        foreach (var userId in userIds)
        {
            var user = await _accounts.FindByIdAsync(userId, cancellationToken);
            if (user is null)
                continue;

            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (email == protectedEmail)
                continue;

            var roles = await _accounts.GetRolesAsync(userId, cancellationToken);
            if (roles.Any(OrgRoles.IsOrgRole))
                continue;

            var errors = await _accounts.DeleteAsync(userId, cancellationToken);
            if (errors.Count > 0)
            {
                throw new InvalidOperationException(
                    "Failed to delete user " + userId + ": "
                    + string.Join("; ", errors.Select(e => e.Description)));
            }

            deleted++;
        }

        return deleted;
    }

    public async Task<(bool Ok, string? Error)> UnlockStaffAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var profile = await _repo.FindProfileAsync(userId, cancellationToken);
        if (profile?.Status == UserStatus.Disabled)
            return (false, "الحساب معطّل — أعد تفعيله قبل فك القفل.");

        await _accounts.ClearLockoutAsync(userId, cancellationToken);
        if (profile is not null && profile.Status == UserStatus.Locked)
        {
            await _repo.ApplyProfileAsync(
                profile with { Status = UserStatus.Active, UpdatedAtUtc = _time.UtcNow() },
                cancellationToken);
        }

        await AddAuditAsync(
            _audit.Create(
                actorId,
                "USER_UNLOCKED",
                "user",
                userId,
                new { locked = true },
                new { locked = false }),
            cancellationToken);
        await SaveIdentityAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteStaffAsync(
        string userId,
        string? requestingUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (false, "معرّف المستخدم غير صالح.");

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null)
            return (false, "المستخدم غير موجود.");

        var refusal = StaffUserRules.DisableRefusalReason(
            user.Email,
            user.UserName,
            userId,
            requestingUserId);
        if (refusal is not null)
            return (false, refusal);

        var profile = await _repo.FindProfileAsync(userId, cancellationToken);
        if (profile is null)
            return (false, "ملف المستخدم غير موجود.");

        var previousStatus = profile.Status;
        await _repo.ApplyProfileAsync(
            profile with { Status = UserStatus.Disabled, UpdatedAtUtc = _time.UtcNow() },
            cancellationToken);
        await AddAuditAsync(
            _audit.Create(
                requestingUserId ?? "system",
                "USER_DISABLED",
                "user",
                userId,
                new { status = previousStatus },
                new { status = UserStatus.Disabled }),
            cancellationToken);
        await _repo.RevokeActiveRefreshTokensAsync(
            userId,
            _time.UtcNow(),
            "user-disabled",
            cancellationToken);

        await _accounts.LockOutIndefinitelyAsync(userId, cancellationToken);
        await SaveIdentityAsync(cancellationToken);

        return (true, null);
    }

    private async Task<StaffProfileState> ApplyStatusChangeAsync(
        StaffIdentityUser user,
        StaffProfileState profile,
        UserStatus status,
        string actorId,
        CancellationToken cancellationToken)
    {
        var previous = profile.Status;
        profile = profile with { Status = status, UpdatedAtUtc = _time.UtcNow() };

        if (status == UserStatus.Disabled)
        {
            await _repo.RevokeActiveRefreshTokensAsync(
                user.Id,
                _time.UtcNow(),
                "user-disabled",
                cancellationToken);
            await _accounts.LockOutIndefinitelyAsync(user.Id, cancellationToken);
        }
        else
        {
            await _accounts.ClearLockoutAsync(user.Id, cancellationToken);
        }

        await AddAuditAsync(
            _audit.Create(
                actorId,
                status == UserStatus.Disabled ? "USER_DISABLED" : "USER_REACTIVATED",
                "user",
                user.Id,
                new { status = previous },
                new { status }),
            cancellationToken);
        return profile;
    }
}
