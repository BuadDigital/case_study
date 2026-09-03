using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Persistence boundary for Enfaz PO billing: revenue lines, invoices, finance flags, and
/// collection follow-ups. The use case in <c>Financial.Application</c> composes these calls;
/// only the Infrastructure adapter opens EF.
/// </summary>
/// <remarks>
/// Every read says whether it is tracked. The save path reads tracked rows, edits them, and
/// commits with <see cref="SaveChangesAsync"/>; read paths take untracked rows.
/// </remarks>
public interface IPoEnfazBillingRepository
{
    /// <summary>Revenue lines of one PO limited to the given properties.</summary>
    Task<IReadOnlyList<PoEnfazRevenueLine>> ListRevenueLinesAsync(
        string poNumber,
        IReadOnlyCollection<Guid> propertyIds,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>Untracked revenue lines of several POs.</summary>
    Task<IReadOnlyList<PoEnfazRevenueLine>> ListRevenueLinesForPosAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    /// <summary>Untracked single revenue line, or null when the property was never priced.</summary>
    Task<PoEnfazRevenueLine?> FindRevenueLineAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);

    void AddRevenueLine(PoEnfazRevenueLine line);

    /// <summary>The PO's invoice, or null when none was issued.</summary>
    Task<PoEnfazInvoice?> FindInvoiceAsync(
        string poNumber,
        bool track,
        CancellationToken cancellationToken);

    /// <summary>Untracked invoices of several POs, keyed by trimmed PO number.</summary>
    Task<IReadOnlyDictionary<string, PoEnfazInvoice>> ListInvoicesByPoAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    /// <summary>Untracked invoices still owing money, oldest issue date first.</summary>
    Task<IReadOnlyList<PoEnfazInvoice>> ListOutstandingInvoicesAsync(
        CancellationToken cancellationToken);

    void AddInvoice(PoEnfazInvoice invoice);

    /// <summary>Untracked finance flags of several POs.</summary>
    Task<IReadOnlyList<PoEnfazFinanceFlag>> ListFinanceFlagsAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    /// <summary>Tracked finance flags of one PO — the set/clear paths edit and delete these.</summary>
    Task<IReadOnlyList<PoEnfazFinanceFlag>> ListFinanceFlagsForPoAsync(
        string poNumber,
        CancellationToken cancellationToken);

    void AddFinanceFlag(PoEnfazFinanceFlag flag);

    void RemoveFinanceFlags(IEnumerable<PoEnfazFinanceFlag> flags);

    /// <summary>Untracked follow-ups of one PO, most recent first, capped at <paramref name="max"/>.</summary>
    Task<IReadOnlyList<PoEnfazFollowup>> ListFollowupsAsync(
        string poNumber,
        int max,
        CancellationToken cancellationToken);

    /// <summary>Follow-up counts per trimmed PO number; POs with none are absent.</summary>
    Task<IReadOnlyDictionary<string, int>> CountFollowupsByPoAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    void AddFollowup(PoEnfazFollowup followup);

    /// <summary>Queues an audit row so it commits with the billing change.</summary>
    void AddAuditLog(AuditLog log);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
