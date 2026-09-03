using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the work-order property write commands. The properties themselves
/// are loaded through <see cref="IWorkOrderLoader"/>; this port owns the writes, the transaction
/// reference allocation, and the contact rewrite that must not share a save with the property
/// update. Only the Infrastructure adapter opens EF.
/// </summary>
public interface IWorkOrderPropertyRepository
{
    /// <summary>Next yearly transaction reference number, or the reason it could not be issued.</summary>
    Task<(string? Reference, string? Error)> AllocateTransactionReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken);

    void AddProperty(WorkOrderProperty property);

    /// <summary>Detaches the contacts so a later rewrite is not turned into DELETE + UPDATE.</summary>
    void DetachContacts(IEnumerable<PropertyContact> contacts);

    /// <summary>
    /// Deletes the property's contacts and inserts <paramref name="rows"/> in their place, in its
    /// own save. Nothing is written when <paramref name="rows"/> is empty.
    /// </summary>
    Task ReplaceContactsAsync(
        Guid propertyId,
        IReadOnlyCollection<PropertyContact> rows,
        CancellationToken cancellationToken);

    /// <summary>Untracked re-read of the saved property with its contacts.</summary>
    Task<WorkOrderProperty> GetSavedPropertyWithContactsAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>Throws <see cref="PersistenceConcurrencyException"/> when the write lost a race.</summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
