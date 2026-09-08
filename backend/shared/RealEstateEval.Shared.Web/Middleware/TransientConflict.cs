namespace RealEstateEval.Shared.Web.Middleware;

/// <summary>
/// Marks a 409 that came from an optimistic-concurrency race (row version changed between
/// read and save) rather than from a domain rule. Such conflicts are transient: the same
/// request replayed a moment later normally succeeds, so the idempotency middleware must not
/// pin the 409 to the key, and clients may retry once before showing the user anything.
/// </summary>
public static class TransientConflict
{
    public const string HeaderName = "X-REE-Transient-Conflict";
    public const string HeaderValue = "1";
}
