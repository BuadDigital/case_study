using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The property's number (ruling 2026-11-08): every deed is numbered at the first full save of its
/// initial data, the property number follows from its deeds, and the first approved report (or the
/// Enfaz handover) locks it; the report numbers are derived from it.
/// </summary>
public interface ITransactionReferenceService
{
    /// <summary>
    /// The deed's property number, locked now (first approved report / Enfaz handover). Numbers any live
    /// deed still without a number first. Idempotent: a locked property keeps its number. Saves.
    /// </summary>
    Task<(string? Reference, string? Error)> ConfirmOfficialReferenceAsync(
        Guid propertyId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Moves the deed's transaction between the study and review; returns the state after the move,
    /// or an Arabic error. Saves only when something changed.
    /// </summary>
    Task<(string? State, string? Error)> SetReviewStateAsync(
        Guid propertyId,
        string state,
        string? userId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    Task<TransactionDto?> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);
}
