namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Stores and replays HTTP command responses keyed by actor + route + Idempotency-Key (ADR 0008).
/// Lives in Shared.Contracts (ADR 0002) so Shared.Web middleware does not reference the global
/// Application assembly. Namespace is unchanged so call sites need no using churn.
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
