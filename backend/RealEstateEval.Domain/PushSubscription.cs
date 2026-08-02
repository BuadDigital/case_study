namespace RealEstateEval.Domain;

/// <summary>Browser Web Push subscription (messaging schema). Multiple per user.</summary>
public class PushSubscription
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    public string? UserAgent { get; set; }
    public string? DeviceLabel { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
    public DateTime? LastSuccessAtUtc { get; set; }
    public int ConsecutiveFailures { get; set; }
    public DateTime? DisabledAtUtc { get; set; }
    public string? DisabledReason { get; set; }
}

/// <summary>Per-user push preference.</summary>
public class PushPreference
{
    public string UserId { get; set; } = "";
    public bool PushEnabled { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }
}
