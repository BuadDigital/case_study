using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the work-order header lifecycle. Reads go through
/// <see cref="IWorkOrderLoader"/> and <see cref="IWorkOrderQuery"/>; this port owns the writes.
/// Only the Infrastructure adapter opens EF.
/// </summary>
public interface IWorkOrderRepository
{
    /// <summary>Next yearly transaction reference number, or the reason it could not be issued.</summary>
    Task<(string? Reference, string? Error)> AllocateTransactionReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken);

    void AddWorkOrder(WorkOrder workOrder);

    Task<bool> HasActiveClientAsync(Guid clientId, CancellationToken cancellationToken);

    /// <summary>
    /// Deletes the work order together with everything keyed to its PO: workflow tasks, their
    /// case-study / party forms, party submissions, field-inspection workspaces, and timeline
    /// entries. Commits in one save.
    /// </summary>
    Task DeleteWorkOrderCascadeAsync(
        WorkOrder workOrder,
        string normalizedPoNumber,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
