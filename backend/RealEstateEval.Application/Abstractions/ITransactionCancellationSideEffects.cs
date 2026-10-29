namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// What a cancelled (or reactivated) transaction changes outside Case Study: open failures on its
/// deeds (Failures) and the envelope records of their keys (Operations). Implemented over the owner
/// services so the case-study use case needs neither context.
/// </summary>
public interface ITransactionCancellationSideEffects
{
    /// <summary>Resolves every open failure of the deed — nothing is left to follow up on a cancelled transaction.</summary>
    Task CloseOpenFailuresAsync(
        string poNumber,
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default);

    /// <summary>Marks (or unmarks) in every key envelope that the deeds' keys belong to a cancelled property.</summary>
    Task SetKeysPropertyCancelledAsync(
        IReadOnlyList<Guid> propertyIds,
        bool cancelled,
        string actorName,
        CancellationToken cancellationToken = default);
}
