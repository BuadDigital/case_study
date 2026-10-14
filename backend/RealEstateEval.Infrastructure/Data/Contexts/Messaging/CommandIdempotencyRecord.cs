namespace RealEstateEval.Domain;

/// <summary>
/// Durable HTTP command idempotency record (ADR 0008). Same actor + route + key
/// replays the stored response instead of re-executing the command.
/// </summary>
public class CommandIdempotencyRecord
{
    /// <summary>Authenticated actor (user id / sub).</summary>
    public string ActorId { get; set; } = "";

    /// <summary>HTTP method (POST, PUT, …).</summary>
    public string HttpMethod { get; set; } = "";

    /// <summary>Request path without query string.</summary>
    public string RequestPath { get; set; } = "";

    /// <summary>Client-supplied <c>Idempotency-Key</c> (8–128 chars).</summary>
    public string IdempotencyKey { get; set; } = "";

    /// <summary>
    /// Unique owner of an in-progress reservation. Null after the response is committed.
    /// </summary>
    public string? ExecutionId { get; set; }

    /// <summary>Zero while the reservation is in progress; otherwise the cached HTTP status.</summary>
    public int StatusCode { get; set; }

    public string? ContentType { get; set; }

    /// <summary>Replay-critical Location header returned by create endpoints.</summary>
    public string? Location { get; set; }

    /// <summary>Response body bytes (may be empty).</summary>
    public byte[] ResponseBody { get; set; } = [];

    public DateTime CreatedAtUtc { get; set; }

    public DateTime ExpiresAtUtc { get; set; }
}
