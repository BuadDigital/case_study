namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Case Study's view of the Failures context for documentary gates: is there an active
/// failure on this PO / property? The adapter talks to the Failures owner API.
/// </summary>
public interface IPartyTaskFailureGate
{
    Task<bool> HasActiveFailureAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);
}
