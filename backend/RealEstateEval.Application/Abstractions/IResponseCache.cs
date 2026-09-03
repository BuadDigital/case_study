namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Read-through cache for expensive read models. Application services depend on this instead of
/// the concrete <c>ApiResponseCache</c> so a use case can move out of Infrastructure without
/// dragging Redis and the distributed-cache packages with it.
/// </summary>
public interface IResponseCache
{
    /// <summary>False when caching is switched off; the factory then runs on every call.</summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Returns the cached value for <paramref name="key"/>, otherwise runs
    /// <paramref name="factory"/> once and stores the result for <paramref name="ttl"/>.
    /// </summary>
    Task<T> GetOrCreateAsync<T>(
        string key,
        TimeSpan ttl,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken = default);

    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
}
