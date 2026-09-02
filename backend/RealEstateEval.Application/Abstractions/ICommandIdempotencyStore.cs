namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Stores and replays HTTP command responses keyed by actor + route + Idempotency-Key (ADR 0008).
/// </summary>
public interface ICommandIdempotencyStore
{
    Task<CommandIdempotencyCachedResponse?> TryGetAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CancellationToken cancellationToken = default);

    Task SaveAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);
}

public sealed record CommandIdempotencyCachedResponse(
    int StatusCode,
    string? ContentType,
    byte[] Body);
