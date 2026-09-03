namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Case Study's view of the Failures context for the documentary work-order flows: the
/// distribution block, the system-raised failures the bourse and location-map rules open, and
/// the resolution that closes them again. Wider than <see cref="IPartyTaskFailureGate"/>, which
/// only answers the party-submission gate. The adapter talks to the Failures owner API, so the
/// use case never compiles against another context's Application contracts.
/// </summary>
public interface ICaseStudyFailureGate
{
    /// <summary>True when an active failure blocks further work on the property.</summary>
    Task<bool> HasBlockingFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Opens the system-raised internal failure for <paramref name="problemKey"/> unless one is
    /// already active for the same PO, property, and problem.
    /// </summary>
    Task EnsureSystemFailureAsync(
        string poNumber,
        string propertyId,
        string? deedNumber,
        string problemKey,
        string problemLabel,
        string detail,
        string raisedByLabel,
        CancellationToken cancellationToken);

    /// <summary>
    /// Resolves every active system-raised failure for <paramref name="problemKey"/> on the
    /// property. No-op when none are active.
    /// </summary>
    Task ResolveSystemFailuresAsync(
        string poNumber,
        string propertyId,
        string problemKey,
        string raiserRole,
        string resolutionReason,
        string continueInstructions,
        CancellationToken cancellationToken);
}
