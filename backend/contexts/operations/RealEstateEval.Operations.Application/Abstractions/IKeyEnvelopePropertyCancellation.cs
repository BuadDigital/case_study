namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Case Study's door into the key envelopes for «إلغاء المعاملة»: mark (or clear) that the deeds'
/// keys belong to a cancelled property. HTTP from the case-study host.
/// </summary>
public interface IKeyEnvelopePropertyCancellation
{
    Task SetPropertiesCancelledAsync(
        IReadOnlyList<Guid> propertyIds,
        bool cancelled,
        string actorName,
        CancellationToken cancellationToken = default);
}
