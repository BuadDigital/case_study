namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Stores and replays HTTP command responses keyed by actor + route + Idempotency-Key (ADR 0008).
/// Lives in Shared.Contracts (ADR 0002) so Shared.Web middleware does not reference the global
/// Application assembly. Namespace is unchanged so call sites need no using churn.
/// </summary>
public interface ICommandIdempotencyStore
{
    Task<CommandIdempotencyAcquireResult> TryAcquireAsync(
        CommandIdempotencyRequestKey key,
        TimeSpan processingLease,
        CancellationToken cancellationToken = default);

    Task<bool> CompleteAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);

    Task ReleaseAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CancellationToken cancellationToken = default);
}

public sealed record CommandIdempotencyRequestKey(
    string ActorId,
    string HttpMethod,
    string RequestPath,
    string IdempotencyKey);

public enum CommandIdempotencyAcquireStatus
{
    Acquired,
    InProgress,
    Replay,
}

public sealed record CommandIdempotencyAcquireResult(
    CommandIdempotencyAcquireStatus Status,
    string? ExecutionId = null,
    CommandIdempotencyCachedResponse? Response = null);

public sealed record CommandIdempotencyCachedResponse(
    int StatusCode,
    string? ContentType,
    byte[] Body,
    string? Location = null);
