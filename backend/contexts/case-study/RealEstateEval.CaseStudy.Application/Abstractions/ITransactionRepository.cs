using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the transaction (the property above the deeds): the deed number
/// counter and the transaction rows. Only the Infrastructure adapter opens EF.
/// </summary>
public interface ITransactionRepository
{
    /// <summary>Next yearly deed number PR-{YY}-{seq} («رقم المعاملة»), or the reason it could not be issued.</summary>
    Task<(string? Reference, string? Error)> AllocateOfficialReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken);

    /// <summary>The transaction a deed belongs to; tracked when <paramref name="track"/> is set.</summary>
    Task<Transaction?> GetByPropertyAsync(
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
