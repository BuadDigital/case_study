using System.Security.Cryptography;
using System.Text;

namespace RealEstateEval.Identity.Application.Rules;

/// <summary>
/// The numbers behind the SMS login code and the pure decisions around them. The service
/// owns storage and sending; everything here is testable without a database.
/// </summary>
public static class LoginOtpRules
{
    public const int CodeLength = 6;

    /// <summary>A code is good for this long after it is issued.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    /// <summary>Matches the login screen's resend timer.</summary>
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(30);

    /// <summary>Wrong guesses allowed on one code before it is dead.</summary>
    public const int MaxAttempts = 5;

    /// <summary>Codes one mobile may request inside <see cref="RequestWindow"/>.</summary>
    public const int MaxRequestsPerWindow = 5;
    public static readonly TimeSpan RequestWindow = TimeSpan.FromMinutes(15);

    /// <summary>Dead rows are kept this long for troubleshooting, then pruned.</summary>
    public static readonly TimeSpan RetainAfterExpiry = TimeSpan.FromDays(1);

    public static string NewCode() =>
        RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    /// <summary>The row id salts the hash so equal codes never share a stored value.</summary>
    public static string Hash(Guid rowId, string code) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{rowId:N}:{code}")));

    public static bool IsWellFormed(string? code) =>
        code is { Length: CodeLength } && code.All(char.IsAsciiDigit);

    /// <summary>The SMS text. Short, Arabic, and carrying nothing but the code and its lifetime.</summary>
    public static string MessageText(string code) =>
        $"رمز الدخول إلى نظام إجادة: {code}\nصالح لمدة {Lifetime.TotalMinutes:0} دقائق. لا تشاركه مع أحد.";

    /// <summary>
    /// Seconds the caller must wait before asking again, or 0 when a new code may be issued now.
    /// <paramref name="lastIssuedAtUtc"/> is the newest live code; <paramref name="issuedInWindow"/>
    /// counts every code (live or not) created inside <see cref="RequestWindow"/>, oldest first.
    /// </summary>
    public static int RetryAfterSeconds(
        DateTime nowUtc,
        DateTime? lastIssuedAtUtc,
        IReadOnlyList<DateTime> issuedInWindow)
    {
        var wait = TimeSpan.Zero;
        if (lastIssuedAtUtc is { } last && nowUtc - last < ResendCooldown)
            wait = ResendCooldown - (nowUtc - last);
        if (issuedInWindow.Count >= MaxRequestsPerWindow)
        {
            var budgetBack = issuedInWindow[0] + RequestWindow - nowUtc;
            if (budgetBack > wait) wait = budgetBack;
        }
        return wait <= TimeSpan.Zero ? 0 : (int)Math.Ceiling(wait.TotalSeconds);
    }

    /// <summary>
    /// The seeded demo accounts carry <c>+9665000000xx</c> numbers nobody owns. On a dev-login
    /// host their code never goes to the provider (no credits burnt, no SMS to a stranger) and
    /// any well-formed code verifies. Production turns dev login off, so the rule is inert there.
    /// </summary>
    public static bool IsSeededDemoMobile(string normalizedMobile) =>
        normalizedMobile.StartsWith("+9665000000", StringComparison.Ordinal);

    /// <summary>A stored code can still be checked: unused, unexpired, and not guessed out.</summary>
    public static bool IsLive(DateTime nowUtc, DateTime expiresAtUtc, DateTime? consumedAtUtc, int attempts) =>
        consumedAtUtc is null && expiresAtUtc > nowUtc && attempts < MaxAttempts;
}
