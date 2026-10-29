using RealEstateEval.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// «إلغاء المعاملة» outside Case Study: open failures are resolved on the Failures owner and the key
/// envelopes record the cancelled property on the Operations owner (HTTP from the case-study host).
/// </summary>
public sealed class TransactionCancellationSideEffects(
    IFailureService failures,
    IKeyEnvelopePropertyCancellation keys) : ITransactionCancellationSideEffects
{
    public Task CloseOpenFailuresAsync(
        string poNumber,
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default) =>
        failures.ResolveForCancelledTransactionAsync(
            poNumber,
            propertyId.ToString(),
            actorName,
            cancellationToken);

    public Task SetKeysPropertyCancelledAsync(
        IReadOnlyList<Guid> propertyIds,
        bool cancelled,
        string actorName,
        CancellationToken cancellationToken = default) =>
        propertyIds.Count == 0
            ? Task.CompletedTask
            : keys.SetPropertiesCancelledAsync(propertyIds, cancelled, actorName, cancellationToken);
}
