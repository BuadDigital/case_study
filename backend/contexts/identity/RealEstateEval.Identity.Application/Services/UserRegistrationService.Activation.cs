using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Rules;

namespace RealEstateEval.Identity.Application.Services;

/// <summary>
/// The activation half of staff registration: an administrator issues a ticket, the holder
/// redeems it to set the first password. Every failure the holder can see is one opaque message
/// (<see cref="StaffProfileRules.ActivationGenericError"/>).
/// </summary>
public partial class UserRegistrationService
{
    public async Task<(ActivationTicketDto? Ticket, string? Error)> IssueActivationTicketAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return (null, "المستخدم غير موجود.");

        var user = await _accounts.FindByIdAsync(userId, cancellationToken);
        if (user is null || string.IsNullOrWhiteSpace(user.UserName))
            return (null, "المستخدم غير موجود.");

        var token = await _accounts.GenerateActivationTokenAsync(user.Id, cancellationToken);
        if (token is null)
            return (null, "المستخدم غير موجود.");

        await AddAuditAsync(
            _audit.Create(
                actorId,
                "USER_ACTIVATION_TICKET_ISSUED",
                "user",
                user.Id,
                null,
                new { issued = true }),
            cancellationToken);
        await SaveIdentityAsync(cancellationToken);
        return (new ActivationTicketDto
        {
            UserName = user.UserName,
            Token = token,
            ExpiresAtUtc = _time.UtcNow().Add(_accounts.ActivationTokenLifespan),
        }, null);
    }

    public async Task<(bool Ok, string? Error)> ActivateAccountAsync(
        ActivateAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        // One opaque message for every failure: unknown user, bad/expired ticket and weak
        // password must be indistinguishable to an unauthenticated caller.
        const string genericError = StaffProfileRules.ActivationGenericError;

        var userName = request.UserName?.Trim() ?? "";
        if (userName.Length == 0
            || string.IsNullOrEmpty(request.Token)
            || string.IsNullOrEmpty(request.NewPassword))
        {
            return (false, genericError);
        }

        var user = await _accounts.FindByNameOrEmailAsync(userName, cancellationToken);
        if (user is null)
            return (false, genericError);

        var profile = await _repo.FindProfileAsync(user.Id, cancellationToken);
        if (StaffProfileRules.ProfileBlocksActivation(profile))
            return (false, genericError);

        var resetErrors = await _accounts.ResetPasswordAsync(
            user.Id,
            request.Token,
            request.NewPassword,
            cancellationToken);
        if (resetErrors.Count > 0)
            return (false, StaffProfileRules.ActivationFailureMessage(resetErrors));

        // Redeeming a ticket clears any lockout left over from failed sign-in attempts.
        await _accounts.ClearLockoutAsync(user.Id, cancellationToken);
        if (profile is not null && profile.Status == UserStatus.PendingActivation)
        {
            var beforeStatus = profile.Status;
            var activated = profile with
            {
                Status = UserStatus.Active,
                UpdatedAtUtc = _time.UtcNow(),
            };
            await _repo.ApplyProfileAsync(activated, cancellationToken);
            await AddAuditAsync(
                _audit.Create(
                    user.Id,
                    "USER_ACTIVATED",
                    "user",
                    user.Id,
                    new { status = beforeStatus },
                    new { status = activated.Status }),
                cancellationToken);
            await SaveIdentityAsync(cancellationToken);
        }
        return (true, null);
    }
}
