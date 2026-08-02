namespace RealEstateEval.Application.Contracts;

public sealed class UpsertFieldSyncStatusRequest
{
    public int PendingCount { get; init; }
    public DateTime? OldestPendingAtUtc { get; init; }
    public IReadOnlyList<string> Kinds { get; init; } = Array.Empty<string>();
    public string? DisplayName { get; init; }
    public string? RoleId { get; init; }
}

public sealed class FieldSyncStatusDto
{
    public Guid Id { get; init; }
    public string UserId { get; init; } = "";
    public string? DisplayName { get; init; }
    public string? RoleId { get; init; }
    public int PendingCount { get; init; }
    public DateTime? OldestPendingAtUtc { get; init; }
    public DateTime LastSeenAtUtc { get; init; }
    public IReadOnlyList<string> Kinds { get; init; } = Array.Empty<string>();
    public double? AgeHours { get; init; }
    public bool Stale { get; init; }
}
