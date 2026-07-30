using System.Text.Json;

namespace RealEstateEval.Application.Contracts;

public sealed class AuditLogDto
{
    public Guid Id { get; init; }
    public required string ActorId { get; init; }
    public required string Action { get; init; }
    public required string EntityType { get; init; }
    public required string EntityId { get; init; }
    public JsonElement Before { get; init; }
    public JsonElement After { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}

public sealed class AuditLogPageDto
{
    public IReadOnlyList<AuditLogDto> Items { get; init; } = [];
    public int Page { get; init; }
    public int Limit { get; init; }
    public int Total { get; init; }
}
