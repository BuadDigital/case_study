using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>One pricing table reduced to the columns the list screen shows.</summary>
public sealed record PricingTableSummaryRow(
    Guid Id,
    string Category,
    string Name,
    string PricingKind,
    string ManagedBy,
    bool IsActive,
    DateTime UpdatedAtUtc);

/// <summary>
/// Persistence boundary for party-fee pricing tables, their area tiers, and their assignee
/// links. The use case in <c>Financial.Application</c> composes these calls; only the
/// Infrastructure adapter opens EF.
/// </summary>
/// <remarks>
/// Reads say whether they are tracked. Tracked reads exist because activation, revision, and
/// assignment replacement mutate the returned rows and commit them with
/// <see cref="SaveChangesAsync"/>; the audit row rides the same unit of work.
/// </remarks>
public interface IPartyFeePricingRepository
{
    /// <summary>Untracked summaries, active first then by name, capped at <paramref name="max"/>.</summary>
    Task<IReadOnlyList<PricingTableSummaryRow>> ListTableSummariesAsync(
        string? category,
        int max,
        CancellationToken cancellationToken);

    /// <summary>Assignment counts per table id; tables with no assignees are absent.</summary>
    Task<IReadOnlyDictionary<Guid, int>> CountAssignmentsByTableAsync(
        IReadOnlyCollection<Guid> tableIds,
        CancellationToken cancellationToken);

    /// <summary>One table with its area tiers, tracked only when asked.</summary>
    Task<PartyFeePricingTable?> GetTableAsync(
        Guid id,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>
    /// Untracked non-flat table of the category whose rates a new table copies by default:
    /// the active one, else the most recently updated.
    /// </summary>
    Task<PartyFeePricingTable?> FindRateSourceTableAsync(
        string category,
        CancellationToken cancellationToken);

    /// <summary>Tracked non-flat table of the category, first by name — the seeder's promotion candidate.</summary>
    Task<PartyFeePricingTable?> FindFirstNonFlatTableByNameAsync(
        string category,
        CancellationToken cancellationToken);

    /// <summary>Untracked active table of the category, with its area tiers.</summary>
    Task<PartyFeePricingTable?> FindActiveTableAsync(
        string category,
        CancellationToken cancellationToken);

    /// <summary>Untracked flat table of the category carrying an amount, first by name.</summary>
    Task<PartyFeePricingTable?> FindFlatTableWithAmountAsync(
        string category,
        CancellationToken cancellationToken);

    /// <summary>Tracked tables of the category that are active today, excluding one id.</summary>
    Task<IReadOnlyList<PartyFeePricingTable>> ListActiveTablesInCategoryAsync(
        string category,
        Guid excludeTableId,
        CancellationToken cancellationToken);

    /// <summary>Tracked table of the category other than <paramref name="excludeTableId"/>, first by name.</summary>
    Task<PartyFeePricingTable?> FindNextTableInCategoryAsync(
        string category,
        Guid excludeTableId,
        CancellationToken cancellationToken);

    Task<bool> AnyTableInCategoryAsync(string category, CancellationToken cancellationToken);

    Task<bool> AnyActiveTableInCategoryAsync(string category, CancellationToken cancellationToken);

    Task<int> CountTablesInCategoryAsync(string category, CancellationToken cancellationToken);

    void AddTable(PartyFeePricingTable table);

    void RemoveTable(PartyFeePricingTable table);

    Task<bool> AnyAssignmentsForTableAsync(Guid tableId, CancellationToken cancellationToken);

    /// <summary>Untracked assignee ids of one table, ordered.</summary>
    Task<IReadOnlyList<string>> ListAssigneeIdsForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken);

    /// <summary>Untracked (table, assignee) pairs of a whole category, ordered — the audit before-image.</summary>
    Task<IReadOnlyList<PricingAssignmentSnapshot>> ListAssignmentSnapshotsByCategoryAsync(
        string category,
        CancellationToken cancellationToken);

    /// <summary>Tracked assignment rows of one table, ordered by assignee.</summary>
    Task<IReadOnlyList<PartyFeePricingAssignment>> ListAssignmentsForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tracked assignments that would break the one-table-per-assignee-per-category rule:
    /// same category, a different table, and an assignee in <paramref name="assigneeIds"/>.
    /// </summary>
    Task<IReadOnlyList<PartyFeePricingAssignment>> ListConflictingAssignmentsAsync(
        string category,
        Guid tableId,
        IReadOnlyCollection<string> assigneeIds,
        CancellationToken cancellationToken);

    /// <summary>Table id assigned to the assignee in the category, or null when unassigned.</summary>
    Task<Guid?> FindAssignedTableIdAsync(
        string category,
        string assigneeId,
        CancellationToken cancellationToken);

    void AddAssignment(PartyFeePricingAssignment assignment);

    void RemoveAssignments(IEnumerable<PartyFeePricingAssignment> assignments);

    /// <summary>Tracked tier rows of one table.</summary>
    Task<IReadOnlyList<PartyFeePricingTier>> ListTiersForTableAsync(
        Guid tableId,
        CancellationToken cancellationToken);

    void RemoveTiers(IEnumerable<PartyFeePricingTier> tiers);

    void AddTiers(IEnumerable<PartyFeePricingTier> tiers);

    /// <summary>
    /// Tier rows of one table as the pending unit of work sees them — new and edited rows
    /// included, deleted ones excluded. Feeds the audit after-image before the save.
    /// </summary>
    IReadOnlyList<PartyFeePricingTier> ListPendingTiers(Guid tableId);

    /// <summary>Queues an audit row so it commits with the pricing change.</summary>
    void AddAuditLog(AuditLog log);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Runs several saves as one transaction. Activation demotes the old default and promotes
    /// the new one in separate statements, so a failure must roll both back.
    /// </summary>
    Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken);
}
