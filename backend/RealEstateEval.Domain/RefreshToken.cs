namespace RealEstateEval.Domain;

/// <summary>
/// Rotating refresh token. Only the SHA-256 hash of the value is persisted, so a
/// database leak cannot be replayed against the token endpoint.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Session family shared by every token produced from one login. Presenting a
    /// token that was already rotated revokes the whole family.
    /// </summary>
    public Guid SessionId { get; set; }

    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? RevokedReason { get; set; }
}
