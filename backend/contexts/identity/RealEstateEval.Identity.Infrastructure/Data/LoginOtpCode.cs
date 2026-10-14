namespace RealEstateEval.Identity.Domain;

/// <summary>
/// One SMS login code. Only its salted SHA-256 hash is stored (see
/// <c>LoginOtpRules.Hash</c>), so a database leak cannot be replayed at the verify endpoint.
/// </summary>
public class LoginOtpCode
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Normalized Saudi mobile the code was sent to (<c>+9665XXXXXXXX</c>).</summary>
    public string Mobile { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;

    /// <summary><c>sms</c> when a provider carried it, <c>dev</c> when it only went to the log.</summary>
    public string Channel { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>Wrong guesses so far; the code dies at <c>LoginOtpRules.MaxAttempts</c>.</summary>
    public int Attempts { get; set; }

    public DateTime? ConsumedAtUtc { get; set; }
}
