namespace RealEstateEval.Domain;

/// <summary>
/// Field-device offline outbox heartbeat for the supervisor «ظروف معلّقة» board
/// (security_offline_spec §6.3). Cleared when pendingCount is 0.
/// </summary>
public class FieldSyncStatus
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? RoleId { get; set; }
    public int PendingCount { get; set; }
    public DateTime? OldestPendingAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
    public string KindsJson { get; set; } = "[]";
}
