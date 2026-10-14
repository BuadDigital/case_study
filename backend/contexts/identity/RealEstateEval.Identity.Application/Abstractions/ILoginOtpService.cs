using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Application.Abstractions;

/// <summary>
/// Mobile login: a one-time code sent by SMS, verified once, then exchanged for a session.
/// </summary>
public interface ILoginOtpService
{
    /// <summary>
    /// Issues and sends a code for the mobile. Unknown or inactive mobiles get the same
    /// <see cref="OtpRequestOutcome.Sent"/> answer as real ones, so the endpoint does not
    /// reveal which numbers have accounts.
    /// </summary>
    Task<OtpRequestOutcome> RequestAsync(string mobile, CancellationToken cancellationToken = default);

    /// <summary>Checks the code and, when it matches, starts a session for its owner.</summary>
    Task<OtpVerifyOutcome> VerifyAsync(string mobile, string code, CancellationToken cancellationToken = default);
}

public enum OtpRequestStatus
{
    /// <summary>A code was issued (or the mobile has no account — same answer on purpose).</summary>
    Sent,
    /// <summary>Asked again inside the cooldown or past the hourly budget; wait <c>RetryAfterSeconds</c>.</summary>
    Throttled,
    /// <summary>The provider refused the message; nothing was stored.</summary>
    SendFailed,
}

public sealed record OtpRequestOutcome(
    OtpRequestStatus Status,
    int RetryAfterSeconds,
    int ExpiresInSeconds,
    string Delivery);

public enum OtpVerifyStatus
{
    Ok,
    /// <summary>Wrong, expired, consumed, or too many attempts — one message for all of them.</summary>
    Invalid,
}

public sealed record OtpVerifyOutcome(OtpVerifyStatus Status, LoginResponseDto? Session)
{
    public static OtpVerifyOutcome Invalid() => new(OtpVerifyStatus.Invalid, null);
}
