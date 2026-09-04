using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Facts of the operations task a key envelope is being linked to. Only the three fields the
/// link rule inspects — the use case never sees the task aggregate.
/// </summary>
public sealed record CourtVisitTaskFacts(
    OperationsTaskType Type,
    OperationsTaskStatus Status,
    string? CourtVisitResultJson);

/// <summary>
/// Persistence boundary for the key-envelope use cases: envelopes with their assignments,
/// handoffs and timeline, the court-access rows, and the yearly KE reference allocation.
/// <c>KeyEnvelopesService</c> in <c>Operations.Application</c> holds the workflow; only the
/// adapter opens <c>OperationsDbContext</c> (solid-scorecard finding 1).
/// </summary>
/// <remarks>
/// Reads named <c>Find*</c> come back tracked and are mutated through the domain aggregate,
/// then persisted by <see cref="SaveAndDetachAsync"/>. Reads named <c>List*</c>/<c>Get*</c>
/// are untracked projections for display.
/// </remarks>
public interface IKeyEnvelopeRepository
{
    /// <summary>Untracked envelopes with assignments, handoffs and timeline, newest first.</summary>
    Task<IReadOnlyList<KeyEnvelope>> ListRecentAsync(int max, CancellationToken cancellationToken);

    /// <summary>Untracked envelope with assignments, handoffs and timeline.</summary>
    Task<KeyEnvelope?> GetWithDetailsAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked envelope, no children loaded.</summary>
    Task<KeyEnvelope?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked envelope with its assignments — the confirm/add-assignment path.</summary>
    Task<KeyEnvelope?> FindWithAssignmentsAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked envelope with every child collection, ready to be removed.</summary>
    Task<KeyEnvelope?> FindWithChildrenAsync(Guid id, CancellationToken cancellationToken);

    Task AddAsync(KeyEnvelope envelope, CancellationToken cancellationToken);

    /// <summary>Removes the envelope; children go through the cascade configuration.</summary>
    Task RemoveAsync(KeyEnvelope envelope, CancellationToken cancellationToken);

    Task AddHandoffAsync(KeyEnvelopeHandoff handoff, CancellationToken cancellationToken);

    Task<KeyEnvelopeHandoff?> FindHandoffAsync(
        Guid envelopeId,
        Guid handoffId,
        CancellationToken cancellationToken);

    Task AddTimelineEntryAsync(KeyEnvelopeTimelineEntry entry, CancellationToken cancellationToken);

    /// <summary>Yearly KE reference number; the error is a user-facing message.</summary>
    Task<(string? Reference, string? Error)> AllocateReferenceNumberAsync(
        DateTime utcNow,
        CancellationToken cancellationToken);

    /// <summary>Untracked envelopes carrying a revenue entitlement or a stamped fee, newest first.</summary>
    Task<IReadOnlyList<KeyEnvelope>> ListRevenueEntitlementsAsync(
        int max,
        CancellationToken cancellationToken);

    /// <summary>Untracked envelopes by id — fills in charges whose envelope missed the page above.</summary>
    Task<IReadOnlyList<KeyEnvelope>> ListByIdsAsync(
        IReadOnlyCollection<Guid> ids,
        CancellationToken cancellationToken);

    Task<bool> HasRevenueEntitlementAsync(Guid envelopeId, CancellationToken cancellationToken);

    /// <summary>Untracked court-access rows, optionally for one request number, newest first.</summary>
    Task<IReadOnlyList<PropertyCourtAccess>> ListCourtAccessAsync(
        string? requestNumber,
        CancellationToken cancellationToken);

    /// <summary>Tracked court-access row for the property, or <c>null</c> when none exists yet.</summary>
    Task<PropertyCourtAccess?> FindCourtAccessAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>Untracked re-read after the write, for the response payload.</summary>
    Task<PropertyCourtAccess?> GetCourtAccessAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task AddCourtAccessAsync(PropertyCourtAccess access, CancellationToken cancellationToken);

    /// <summary>The three fields the envelope-to-court-visit link rule checks.</summary>
    Task<CourtVisitTaskFacts?> FindCourtVisitTaskFactsAsync(
        Guid taskId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Persists the unit of work and clears the change tracker, so the untracked re-read that
    /// follows every command returns the committed row rather than a stale tracked graph.
    /// </summary>
    Task SaveAndDetachAsync(CancellationToken cancellationToken);
}
