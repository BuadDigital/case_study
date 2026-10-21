using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The transaction numbers (decision 2026-10-19): a draft number at intake, the official PR
/// reference at the first approval of the case-study report or the valuation report, and the
/// report numbers derived from it.
/// </summary>
public interface ITransactionReferenceService
{
    /// <summary>A new draft transaction with its D- number; not yet saved (the caller's unit of work saves it).</summary>
    Task<(Transaction? Transaction, string? Error)> CreateDraftAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The deed's transaction with its official reference, drawn now if it had none. Idempotent:
    /// a transaction already confirmed keeps its number. Saves.
    /// </summary>
    Task<(string? Reference, string? Error)> ConfirmOfficialReferenceAsync(
        Guid propertyId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    Task<TransactionDto?> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);
}
