using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Reads of the transaction above the deeds: the header with its deeds, and one timeline for all of them.</summary>
public interface ITransactionQuery
{
    /// <summary>The deed's transaction with every deed in it; null when the deed does not exist.</summary>
    Task<TransactionDetailDto?> GetByPropertyAsync(
        Guid propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<TransactionDetailDto?> GetAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The deeds' timelines merged into one, oldest first; every event says which deed it belongs to
    /// and its id is prefixed by the deed so two deeds' identical keys never collide.
    /// </summary>
    Task<IReadOnlyList<PropertyTimelineEventDto>?> GetTimelineAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
