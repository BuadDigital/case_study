namespace RealEstateEval.Application.Contracts;

/// <summary>
/// An amount together with the pricing table it came from. The two travel as one value so a
/// consumer cannot stamp the money and drop the provenance — without the table id there is no way
/// to prove after the fact which schedule produced a party's fee.
/// </summary>
public readonly record struct ResolvedPartyFee(decimal? FeeSar, Guid? PricingTableId)
{
    /// <summary>No rate was configured, or the party is not priced from a table at all.</summary>
    public static readonly ResolvedPartyFee Unresolved = new(null, null);

    public bool IsResolved => FeeSar is > 0m;
}
