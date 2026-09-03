using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AuditLogWriter : IAuditLogWriter
{
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;
    private readonly TimeProvider _time;

    public AuditLogWriter(TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;
    }

    public AuditLog Create(
        string actorId,
        string action,
        string entityType,
        string entityId,
        object? before,
        object? after)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actorId);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(entityType);
        ArgumentException.ThrowIfNullOrWhiteSpace(entityId);

        return new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actorId.Trim(),
            Action = action.Trim(),
            EntityType = entityType.Trim(),
            EntityId = entityId.Trim(),
            BeforeJson = JsonSerializer.Serialize(before, JsonOptions),
            AfterJson = JsonSerializer.Serialize(after, JsonOptions),
            CreatedAtUtc = _time.UtcNow(),
        };
    }

    public AuditLog CreateFromChanges(
        string actorId,
        string action,
        string entityType,
        string entityId,
        IReadOnlyDictionary<string, AuditValueChange> changes)
    {
        ArgumentNullException.ThrowIfNull(changes);

        var before = changes.ToDictionary(pair => pair.Key, pair => pair.Value.Before);
        var after = changes.ToDictionary(pair => pair.Key, pair => pair.Value.After);
        return Create(actorId, action, entityType, entityId, before, after);
    }
}
