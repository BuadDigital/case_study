using RealEstateEval.Domain;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>Admin listing filter. Blank members mean "no filter".</summary>
public sealed record CourtAdminFilter(string? Search, string? Status, string? Region, string? City);

/// <summary>A court row plus the circuit count the admin table shows, without loading circuits.</summary>
public sealed record CourtWithCircuitCount(Court Court, int CircuitsCount);

/// <summary>
/// Persistence boundary for the courts and circuits catalog. <c>CourtsService</c> in
/// <c>Platform.Application</c> owns seeding, validation, audit shaping and cache invalidation;
/// only the adapter opens <c>PlatformDbContext</c> (solid-scorecard finding 1).
/// </summary>
public interface ICourtsRepository
{
    /// <summary>True once the catalog holds at least one court — the seed short-circuit.</summary>
    Task<bool> AnyCourtsAsync(CancellationToken cancellationToken);

    /// <summary>Untracked legacy catalog rows, read once by the seeding path.</summary>
    Task<IReadOnlyList<CourtCatalogEntry>> ListLegacyCatalogAsync(CancellationToken cancellationToken);

    /// <summary>Tracked courts with their circuits — the seed reconciliation working set.</summary>
    Task<IReadOnlyList<Court>> ListCourtsWithCircuitsAsync(CancellationToken cancellationToken);

    Task AddCourtAsync(Court court, CancellationToken cancellationToken);

    Task AddCircuitAsync(CourtCircuit circuit, CancellationToken cancellationToken);

    /// <summary>Nothing to persist means nothing to invalidate; keeps seeding idempotent.</summary>
    bool HasPendingChanges();

    Task<int> CountAdminAsync(CourtAdminFilter filter, CancellationToken cancellationToken);

    /// <summary>One untracked page of the admin table, ordered by city then name.</summary>
    Task<IReadOnlyList<CourtWithCircuitCount>> ListAdminPageAsync(
        CourtAdminFilter filter,
        int skip,
        int take,
        CancellationToken cancellationToken);

    /// <summary>Untracked court with its circuits, for the detail payload.</summary>
    Task<Court?> GetCourtWithCircuitsAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked court, no circuits loaded.</summary>
    Task<Court?> FindCourtAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked court with its circuits, for edits that report the circuit count.</summary>
    Task<Court?> FindCourtWithCircuitsAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Name is unique per city; <paramref name="excludingId"/> skips the row being edited.</summary>
    Task<bool> CourtNameTakenAsync(
        string name,
        string city,
        Guid? excludingId,
        CancellationToken cancellationToken);

    Task<CourtCircuit?> FindCircuitAsync(
        Guid courtId,
        Guid circuitId,
        CancellationToken cancellationToken);

    /// <summary>Circuit number is unique per court; <paramref name="excludingId"/> skips the row being edited.</summary>
    Task<bool> CircuitNoTakenAsync(
        Guid courtId,
        string circuitNo,
        Guid? excludingId,
        CancellationToken cancellationToken);

    /// <summary>Untracked active courts, optionally narrowed to a region and city.</summary>
    Task<IReadOnlyList<Court>> ListActiveCourtsAsync(
        string? region,
        string? city,
        CancellationToken cancellationToken);

    Task<bool> IsCourtActiveAsync(Guid courtId, CancellationToken cancellationToken);

    /// <summary>Untracked active circuits of one court, ordered by circuit number.</summary>
    Task<IReadOnlyList<CourtCircuit>> ListActiveCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken);

    /// <summary>Stages the audit row so it commits with the catalog change (D7).</summary>
    Task AppendAuditAsync(AuditLog entry, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
