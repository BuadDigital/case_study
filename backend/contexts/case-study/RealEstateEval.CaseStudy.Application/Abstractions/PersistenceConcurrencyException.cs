namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// A write lost the optimistic-concurrency race. Infrastructure adapters raise this instead of
/// leaking the ORM's own exception, so a use case can retry against a fresh load or report the
/// clash without naming EF types.
/// </summary>
public sealed class PersistenceConcurrencyException : Exception
{
    public PersistenceConcurrencyException(string conflictingEntries, Exception innerException)
        : base("A concurrent write changed the same rows.", innerException) =>
        ConflictingEntries = conflictingEntries;

    /// <summary>
    /// Human-readable "<c>Type:State</c>" list of the rows that clashed, for diagnostics text.
    /// Empty when the adapter could not describe them.
    /// </summary>
    public string ConflictingEntries { get; }
}
